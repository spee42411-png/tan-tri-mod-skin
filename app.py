import json, os, sqlite3
from pathlib import Path
from functools import wraps
from flask import Flask, jsonify, render_template, request, session, redirect, url_for, flash, abort

BASE = Path(__file__).resolve().parent
DATA_FILE = BASE / 'data' / 'aov_skins.json'
DB_FILE = Path(os.environ.get('DATABASE_PATH', str(BASE / 'data' / 'site.db')))
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-only-change-this-before-deploying')
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax')


def load_source():
    with DATA_FILE.open(encoding='utf-8') as f:
        return json.load(f)


def connect():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_FILE)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with connect() as con:
        con.execute('''CREATE TABLE IF NOT EXISTS custom_skins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hero TEXT NOT NULL,
            skin_id TEXT NOT NULL,
            skin_name TEXT NOT NULL,
            image_url TEXT DEFAULT '',
            note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(hero, skin_id)
        )''')

init_db()


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('admin'):
            return redirect(url_for('admin_login', next=request.path))
        return fn(*args, **kwargs)
    return wrapper


@app.get('/')
def index():
    source = load_source()
    with connect() as con:
        custom_count = con.execute('SELECT COUNT(*) FROM custom_skins').fetchone()[0]
    return render_template('index.html', hero_count=len(source), skin_count=sum(len(v) for v in source.values()), custom_count=custom_count)


@app.get('/api/heroes')
def api_heroes():
    source = load_source()
    q = request.args.get('q', '').strip().casefold()
    result = []
    for hero, skins in source.items():
        if not q or q in hero.casefold() or any(q in name.casefold() or q in sid for sid, name in skins.items()):
            result.append({'name': hero, 'skin_count': len(skins)})
    return jsonify(result)


@app.get('/api/skins')
def api_skins():
    source = load_source()
    hero = request.args.get('hero', '').strip()
    q = request.args.get('q', '').strip().casefold()
    result = []
    for hero_name, skins in source.items():
        if hero and hero_name.casefold() != hero.casefold():
            continue
        for skin_id, skin_name in skins.items():
            if not q or q in hero_name.casefold() or q in skin_name.casefold() or q in skin_id:
                result.append({'hero': hero_name, 'id': skin_id, 'name': skin_name, 'source': 'source'})
    with connect() as con:
        rows = con.execute('SELECT hero, skin_id, skin_name, image_url, note FROM custom_skins').fetchall()
    for row in rows:
        item = {'hero': row['hero'], 'id': row['skin_id'], 'name': row['skin_name'], 'image_url': row['image_url'], 'note': row['note'], 'source': 'custom'}
        if (not hero or item['hero'].casefold() == hero.casefold()) and (not q or any(q in str(item[k]).casefold() for k in ('hero','id','name'))):
            result.append(item)
    return jsonify(result)


@app.get('/api/stats')
def api_stats():
    source = load_source()
    with connect() as con:
        custom = con.execute('SELECT COUNT(*) FROM custom_skins').fetchone()[0]
    return jsonify({'heroes': len(source), 'source_skins': sum(map(len, source.values())), 'custom_skins': custom})


@app.get('/admin/login')
def admin_login():
    return render_template('login.html')


@app.post('/admin/login')
def admin_login_post():
    password = os.environ.get('ADMIN_PASSWORD')
    if not password:
        flash('ADMIN_PASSWORD chua duoc cau hinh tren hosting.', 'error')
        return redirect(url_for('admin_login'))
    if request.form.get('password', '') == password:
        session['admin'] = True
        return redirect(url_for('admin'))
    flash('Mat khau khong dung.', 'error')
    return redirect(url_for('admin_login'))


@app.get('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('index'))


@app.get('/admin')
@admin_required
def admin():
    with connect() as con:
        rows = con.execute('SELECT * FROM custom_skins ORDER BY created_at DESC').fetchall()
    return render_template('admin.html', rows=rows)


@app.post('/admin/skins')
@admin_required
def add_skin():
    hero = request.form.get('hero', '').strip()
    skin_id = request.form.get('skin_id', '').strip()
    skin_name = request.form.get('skin_name', '').strip()
    image_url = request.form.get('image_url', '').strip()
    note = request.form.get('note', '').strip()
    if not hero or not skin_id or not skin_name:
        flash('Can nhap ten tuong, ma skin va ten skin.', 'error')
        return redirect(url_for('admin'))
    if len(hero) > 80 or len(skin_id) > 20 or len(skin_name) > 120 or len(note) > 500:
        abort(400)
    if image_url and not image_url.startswith(('https://', 'http://')):
        flash('Anh minh hoa phai la URL http/https.', 'error')
        return redirect(url_for('admin'))
    try:
        with connect() as con:
            con.execute('INSERT INTO custom_skins(hero, skin_id, skin_name, image_url, note) VALUES(?,?,?,?,?)', (hero, skin_id, skin_name, image_url, note))
        flash('Da them muc skin vao danh muc rieng.', 'success')
    except sqlite3.IntegrityError:
        flash('Tuong va ma skin nay da ton tai trong danh muc rieng.', 'error')
    return redirect(url_for('admin'))


@app.post('/admin/skins/<int:item_id>/delete')
@admin_required
def delete_skin(item_id):
    with connect() as con:
        con.execute('DELETE FROM custom_skins WHERE id=?', (item_id,))
    flash('Da xoa muc tu danh muc rieng.', 'success')
    return redirect(url_for('admin'))


@app.get('/health')
def health():
    return {'status': 'ok'}


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '5000')), debug=False)

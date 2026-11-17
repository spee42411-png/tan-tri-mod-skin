(() => {
  const grid = document.getElementById('skinGrid');
  if (!grid) return;
  const search = document.getElementById('searchInput');
  const heroFilter = document.getElementById('heroFilter');
  const count = document.getElementById('resultCount');
  let timer;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function loadHeroes() {
    const heroes = await fetch('/api/heroes').then(r => r.json());
    heroes.forEach(h => { const o = document.createElement('option'); o.value = h.name; o.textContent = `${h.name} (${h.skin_count})`; heroFilter.appendChild(o); });
  }
  async function loadSkins() {
    grid.innerHTML = '<div class="loading">Đang tìm kiếm…</div>';
    const p = new URLSearchParams(); if (search.value.trim()) p.set('q', search.value.trim()); if (heroFilter.value) p.set('hero', heroFilter.value);
    try {
      const data = await fetch('/api/skins?' + p).then(r => { if (!r.ok) throw Error(); return r.json(); });
      count.textContent = `${data.length.toLocaleString('vi-VN')} kết quả`;
      if (!data.length) { grid.innerHTML = '<div class="empty">Không tìm thấy kết quả phù hợp.</div>'; return; }
      grid.innerHTML = data.slice(0, 180).map((s, i) => `<article class="skin-card"><div class="skin-visual ${i%5===0?'red':''}"><span class="visual-symbol">✦</span><span class="skin-id">${esc(s.id)}</span>${s.image_url ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" loading="lazy" onerror="this.remove()">` : ''}</div><div class="skin-info"><span class="hero-name">${esc(s.hero)}</span><h3>${esc(s.name)}</h3><div class="card-bottom"><span>${s.source==='custom'?'Danh mục riêng':'Dữ liệu nguồn'}</span><button class="copy-id" data-copy="${esc(s.id)}" title="Sao chép mã skin">Sao chép mã</button></div></div></article>`).join('');
      grid.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent='Đã chép ✓'; setTimeout(()=>b.textContent='Sao chép mã',1200); } catch { b.textContent=b.dataset.copy; } }));
      if (data.length > 180) grid.insertAdjacentHTML('beforeend', `<div class="source-note">Đang hiển thị 180 kết quả đầu tiên. Hãy tìm kiếm cụ thể hơn để lọc nhanh.</div>`);
    } catch { grid.innerHTML = '<div class="empty">Không tải được dữ liệu. Vui lòng tải lại trang.</div>'; }
  }
  search.addEventListener('input', () => { clearTimeout(timer); timer=setTimeout(loadSkins,180); });
  heroFilter.addEventListener('change', loadSkins);
  loadHeroes().then(loadSkins).catch(loadSkins);
})();


(() => {
  const grid = document.getElementById('skinGrid');
  if (!grid) return;

  const search = document.getElementById('searchInput');
  const heroFilter = document.getElementById('heroFilter');
  const count = document.getElementById('resultCount');

  const HERO_DATA_URL =
    'https://cdn.jsdelivr.net/gh/MLuc24/lien-quan-data@main/data/heroes.json';

  let timer;
  let imageDataPromise;

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const normalize = value =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  async function getImageData() {
    if (!imageDataPromise) {
      imageDataPromise = fetch(HERO_DATA_URL)
        .then(response => {
          if (!response.ok) throw new Error('Không tải được dữ liệu ảnh');
          return response.json();
        })
        .catch(error => {
          console.warn('Lỗi tải dữ liệu ảnh skin:', error);
          return [];
        });
    }
    return imageDataPromise;
  }

  async function getSkinImage(heroName, skinName) {
    const heroes = await getImageData();

    const hero = heroes.find(item =>
      normalize(item.name) === normalize(heroName)
    );

    if (!hero || !Array.isArray(hero.skins)) return '';

    const target = normalize(skinName);

    let skin = hero.skins.find(item =>
      normalize(item.shortName) === target ||
      normalize(item.name) === target
    );

    if (!skin) {
      skin = hero.skins.find(item => {
        const shortName = normalize(item.shortName);
        const fullName = normalize(item.name);
        return (
          (shortName && (shortName.includes(target) || target.includes(shortName))) ||
          (fullName && (fullName.includes(target) || target.includes(fullName)))
        );
      });
    }

    return skin ? (skin.splash || skin.thumb || '') : '';
  }

  async function loadHeroes() {
    const response = await fetch('/api/heroes');
    if (!response.ok) throw new Error('Không tải được tướng');

    const heroes = await response.json();
    heroFilter.innerHTML = '<option value="">Tất cả tướng</option>';

    heroes.forEach(hero => {
      const option = document.createElement('option');
      option.value = hero.name;
      option.textContent = `${hero.name} (${hero.skin_count})`;
      heroFilter.appendChild(option);
    });
  }

  async function loadSkins() {
    grid.innerHTML = '<div class="loading">Đang tải danh sách skin...</div>';

    const params = new URLSearchParams();

    if (search.value.trim()) {
      params.set('q', search.value.trim());
    }

    if (heroFilter.value) {
      params.set('hero', heroFilter.value);
    }

    try {
      const response = await fetch('/api/skins?' + params);
      if (!response.ok) throw new Error('Không tải được skin');

      const data = await response.json();

      count.textContent =
        `${data.length.toLocaleString('vi-VN')} kết quả`;

      if (!data.length) {
        grid.innerHTML =
          '<div class="empty">Không tìm thấy kết quả phù hợp.</div>';
        return;
      }

      const displayed = data.slice(0, 180);

      const cards = await Promise.all(displayed.map(async (skin, index) => {
        const imageUrl =
          skin.image_url || await getSkinImage(skin.hero, skin.name);

        return `
          <article class="skin-card">
            <div class="skin-visual ${index % 5 === 0 ? 'red' : ''}"
                 style="position:relative;overflow:hidden;">
              ${imageUrl ? `
                <img
                  src="${esc(imageUrl)}"
                  alt="${esc(skin.name)}"
                  loading="lazy"
                  style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
                  onerror="this.style.display='none'"
                >
              ` : ''}
              <span class="visual-symbol"
                    style="position:relative;z-index:1;">✦</span>
              <span class="skin-id"
                    style="position:relative;z-index:1;">${esc(skin.id)}</span>
            </div>

            <div class="skin-info">
              <span class="hero-name">${esc(skin.hero)}</span>
              <h3>${esc(skin.name)}</h3>
              <div class="card-bottom">
                <span>${skin.source === 'custom'
                  ? 'Danh mục riêng'
                  : 'Dữ liệu nguồn'}</span>
                <button class="copy-id"
                        data-copy="${esc(skin.id)}"
                        title="Sao chép mã skin">
                  Sao chép mã
                </button>
              </div>
            </div>
          </article>
        `;
      }));

      grid.innerHTML = cards.join('');

      grid.querySelectorAll('[data-copy]').forEach(button => {
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(button.dataset.copy);
            button.textContent = 'Đã chép ✓';
          } catch {
            button.textContent = button.dataset.copy;
          }
        });
      });

      if (data.length > 180) {
        grid.insertAdjacentHTML(
          'beforeend',
          '<div class="source-note">Đang hiển thị 180 kết quả đầu tiên. Hãy tìm kiếm cụ thể hơn để lọc nhanh.</div>'
        );
      }
    } catch (error) {
      console.error(error);
      grid.innerHTML =
        '<div class="empty">Không tải được dữ liệu. Vui lòng tải lại trang.</div>';
    }
  }

  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(loadSkins, 250);
  });

  heroFilter.addEventListener('change', loadSkins);

  loadHeroes()
    .then(loadSkins)
    .catch(error => {
      console.error(error);
      loadSkins();
    });
})();

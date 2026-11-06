import os
import json
import webbrowser

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wishlist vs Biblioteca Digital - Auditor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f17;
      --card-bg: #141c2b;
      --card-border: #1e293b;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent-green: #10b981;
      --accent-yellow: #f59e0b;
      --accent-red: #ef4444;
      --accent-blue: #3b82f6;
      --accent-star: #eab308;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 24px;
    }
    .header-title h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-title p {
      color: var(--text-muted);
      font-size: 13px;
      font-family: 'JetBrains Mono', monospace;
      margin-top: 4px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }
    .stat-val {
      font-size: 28px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
    }
    .stat-lbl {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .val-green { color: var(--accent-green); }
    .val-yellow { color: var(--accent-yellow); }
    .val-red { color: var(--accent-red); }
    .val-blue { color: var(--accent-blue); }

    .controls-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
      align-items: center;
      justify-content: space-between;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn-filter {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-filter:hover, .btn-filter.active {
      background: #1e293b;
      color: #fff;
      border-color: #3b82f6;
    }
    .search-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      min-width: 260px;
      outline: none;
    }
    .search-box:focus { border-color: var(--accent-blue); }

    .btn-action {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      transition: background 0.2s;
    }
    .btn-action:hover { background: #1d4ed8; }

    .releases-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .release-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 18px;
      transition: border-color 0.2s;
    }
    .release-card:hover { border-color: #334155; }
    .release-header {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .release-thumb {
      width: 68px;
      height: 68px;
      border-radius: 8px;
      object-fit: cover;
      background: #1e293b;
      flex-shrink: 0;
    }
    .release-info { flex-grow: 1; min-width: 0; }
    .release-artist {
      font-size: 13px;
      font-weight: 700;
      color: var(--accent-blue);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .release-title {
      font-size: 17px;
      font-weight: 800;
      color: #fff;
      margin: 2px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge-star {
      color: var(--accent-star);
      font-size: 14px;
    }
    .release-meta {
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .release-meta a {
      color: var(--text-muted);
      text-decoration: none;
    }
    .release-meta a:hover { color: #fff; text-decoration: underline; }

    .release-status-box {
      text-align: right;
      min-width: 140px;
      flex-shrink: 0;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: 'JetBrains Mono', monospace;
    }
    .status-full { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); border: 1px solid rgba(16, 185, 129, 0.3); }
    .status-partial { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); border: 1px solid rgba(245, 158, 11, 0.3); }
    .status-missing { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.3); }

    .progress-bar-bg {
      background: #1e293b;
      height: 6px;
      border-radius: 3px;
      margin-top: 8px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      transition: width 0.3s;
    }

    .tracklist-container {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid #1e293b;
    }
    .track-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .track-row:hover { background: rgba(255,255,255,0.03); }
    .track-found { color: var(--text-main); }
    .track-missing { color: #64748b; }
    .track-pos {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      min-width: 28px;
      color: var(--text-muted);
    }
    .track-name { flex-grow: 1; }
    .track-file {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--accent-green);
      background: rgba(16, 185, 129, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .icon-ok { color: var(--accent-green); font-weight: bold; }
    .icon-no { color: var(--accent-red); font-weight: bold; }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 14px;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      z-index: 999;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-title">
        <h1><span>💿</span> Auditor de Wishlist vs Música Digital</h1>
        <p>Comparación automática entre tu Wantlist de vinilos y tu biblioteca digital</p>
      </div>
      <div>
        <button class="btn-action" onclick="copyMissingTracks()">📋 Copiar Tracks Faltantes (Soulseek/Búsqueda)</button>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val val-blue" id="stat-total">0</div>
        <div class="stat-lbl">Discos en Wishlist</div>
      </div>
      <div class="stat-card">
        <div class="stat-val val-green" id="stat-full">0</div>
        <div class="stat-lbl">🟢 Álbumes Completos</div>
      </div>
      <div class="stat-card">
        <div class="stat-val val-yellow" id="stat-partial">0</div>
        <div class="stat-lbl">🟡 Con Tracks Sueltos</div>
      </div>
      <div class="stat-card">
        <div class="stat-val val-red" id="stat-missing">0</div>
        <div class="stat-lbl">🔴 Sin Nada en Digital</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="stat-audio-files" style="color: #a855f7;">0</div>
        <div class="stat-lbl">Archivos Escaneados</div>
      </div>
    </div>

    <div class="controls-row">
      <div class="filters">
        <button class="btn-filter active" onclick="setFilter('all', this)">Todos</button>
        <button class="btn-filter" onclick="setFilter('full', this)">🟢 Completos</button>
        <button class="btn-filter" onclick="setFilter('partial', this)">🟡 Sueltos</button>
        <button class="btn-filter" onclick="setFilter('missing', this)">🔴 Faltantes</button>
        <button class="btn-filter" onclick="setFilter('priority', this)">⭐ Prioritarios</button>
      </div>
      <input type="text" class="search-box" id="search-input" placeholder="Buscar artista, título..." oninput="renderReleases()">
    </div>

    <div class="releases-grid" id="releases-container"></div>
  </div>

  <div class="toast" id="toast">Copiado al portapapeles</div>

  <script>
    const DATA = __DATA_PLACEHOLDER__;

    let currentFilter = 'all';

    function init() {
      document.getElementById('stat-total').textContent = DATA.summary.total_releases;
      document.getElementById('stat-full').textContent = DATA.summary.full_count;
      document.getElementById('stat-partial').textContent = DATA.summary.partial_count;
      document.getElementById('stat-missing').textContent = DATA.summary.missing_count;
      document.getElementById('stat-audio-files').textContent = DATA.summary.total_audio_files;
      renderReleases();
    }

    function setFilter(filter, btn) {
      currentFilter = filter;
      document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderReleases();
    }

    function renderReleases() {
      const query = (document.getElementById('search-input').value || '').toLowerCase().trim();
      const container = document.getElementById('releases-container');
      container.innerHTML = '';

      const filtered = DATA.releases.filter(r => {
        if (currentFilter === 'full' && r.status !== 'full') return false;
        if (currentFilter === 'partial' && r.status !== 'partial') return false;
        if (currentFilter === 'missing' && r.status !== 'missing') return false;
        if (currentFilter === 'priority' && !r.is_priority) return false;

        if (query) {
          const matchArtist = (r.artist_str || '').toLowerCase().includes(query);
          const matchTitle = (r.title || '').toLowerCase().includes(query);
          const matchTracks = (r.tracks || []).some(t => t.title.toLowerCase().includes(query));
          if (!matchArtist && !matchTitle && !matchTracks) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;">No se encontraron discos con este filtro.</div>';
        return;
      }

      filtered.forEach(r => {
        const card = document.createElement('div');
        card.className = 'release-card';

        let statusClass = 'status-missing';
        let statusLabel = 'FALTANTE (0%)';
        let barColor = 'var(--accent-red)';
        if (r.status === 'full') {
          statusClass = 'status-full';
          statusLabel = `COMPLETO (${r.found_count}/${r.total_tracks})`;
          barColor = 'var(--accent-green)';
        } else if (r.status === 'partial') {
          statusClass = 'status-partial';
          statusLabel = `PARCIAL (${r.found_count}/${r.total_tracks})`;
          barColor = 'var(--accent-yellow)';
        }

        const thumb = r.thumb || 'https://via.placeholder.com/150/1e293b/94a3b8?text=VINYL';
        const discogsUrl = `https://www.discogs.com/release/${r.id}`;

        let tracksHtml = '';
        (r.tracks || []).forEach(t => {
          const isOk = t.found;
          tracksHtml += `
            <div class="track-row ${isOk ? 'track-found' : 'track-missing'}">
              <span class="track-pos">${t.position || '-'}</span>
              <span class="track-name">${isOk ? '<span class="icon-ok">✔</span>' : '<span class="icon-no">✖</span>'} ${t.title}</span>
              ${isOk ? `<span class="track-file" title="${t.local_path}">📁 ${t.local_filename}</span>` : '<span style="font-size:11px; color:#64748b;">Falta</span>'}
            </div>
          `;
        });

        card.innerHTML = `
          <div class="release-header">
            <img class="release-thumb" src="${thumb}" alt="Cover" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'68\\' height=\\'68\\' fill=\\'%23334155\\'><rect width=\\'100%\\' height=\\'100%\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%2394a3b8\\' text-anchor=\\'middle\\' dy=\\'.3em\\'>VINILO</text></svg>'">
            <div class="release-info">
              <div class="release-artist">${r.artist_str}</div>
              <div class="release-title">
                ${r.title}
                ${r.is_priority ? '<span class="badge-star" title="Marcado como Favorito ★">★</span>' : ''}
              </div>
              <div class="release-meta">
                ${r.year ? `<span>${r.year}</span> • ` : ''}
                <a href="${discogsUrl}" target="_blank">Discogs #${r.id} ↗</a>
              </div>
            </div>
            <div class="release-status-box">
              <span class="status-badge ${statusClass}">${statusLabel}</span>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${r.percentage}%; background: ${barColor};"></div>
              </div>
            </div>
          </div>
          <div class="tracklist-container">
            ${tracksHtml}
          </div>
        `;
        container.appendChild(card);
      });
    }

    function copyMissingTracks() {
      const missingList = [];
      DATA.releases.forEach(r => {
        (r.tracks || []).forEach(t => {
          if (!t.found) {
            missingList.push(`${r.artist_str} - ${t.title}`);
          }
        });
      });

      if (missingList.length === 0) {
        showToast('¡No te falta ningún track! Todo está completo.');
        return;
      }

      navigator.clipboard.writeText(missingList.join('\\n')).then(() => {
        showToast(`Copiados ${missingList.length} tracks faltantes al portapapeles.`);
      }).catch(() => {
        alert('Error al copiar al portapapeles.');
      });
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 4000);
    }

    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>
"""

def generate_report(releases_data, summary_data, output_path="reporte_wishlist_digital.html", auto_open=True):
    full_data = {
        "summary": summary_data,
        "releases": releases_data
    }
    
    html_content = HTML_TEMPLATE.replace("__DATA_PLACEHOLDER__", json.dumps(full_data, ensure_ascii=False))
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"\n[Reporte] Reporte generado exitosamente en: {os.path.abspath(output_path)}")
    
    if auto_open:
        try:
            webbrowser.open(f"file://{os.path.abspath(output_path)}")
        except Exception:
            pass


/**
 * Vinyl Stock Manager • Radar & Progress Renderer (js/ui/radar-renderer.js)
 * Visual canvas radar shader, spinning vinyl turntable animation, and live progress cards.
 * Presentation layer component.
 */

(function(global) {
  'use strict';

  let radarAnimFrameId = null;

  const RadarRenderer = {
    startRadarCanvas() {
      const canvas = document.getElementById('scan-radar-canvas');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      let angle = 0;
      let laserY = 0;
      let laserDirection = 1;
      let animTick = 0;

      function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const w = rect.width || canvas.offsetWidth || 800;
        const h = rect.height || canvas.offsetHeight || 520;

        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);
        return { width: w, height: h };
      }

      function draw() {
        const { width, height } = resizeCanvas();
        ctx.clearRect(0, 0, width, height);

        animTick++;
        angle += 0.015;

        // 1. Grid
        const gridSize = 42;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.032)';
        ctx.lineWidth = 1;

        for (let x = gridSize; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = gridSize; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // 2. Radar sweep & concentric rings
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) * 0.42;

        [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
          ctx.beginPath();
          ctx.arc(centerX, centerY, maxRadius * ratio, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(224, 43, 32, 0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Sweep cone
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, angle - 0.35, angle);
        ctx.closePath();
        const sweepGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        sweepGrad.addColorStop(0, 'rgba(224, 43, 32, 0.25)');
        sweepGrad.addColorStop(1, 'rgba(224, 43, 32, 0.0)');
        ctx.fillStyle = sweepGrad;
        ctx.fill();
        ctx.restore();

        // Laser scan line
        laserY += 1.8 * laserDirection;
        if (laserY > height) { laserY = height; laserDirection = -1; }
        if (laserY < 0) { laserY = 0; laserDirection = 1; }

        ctx.strokeStyle = 'rgba(224, 43, 32, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, laserY);
        ctx.lineTo(width, laserY);
        ctx.stroke();

        radarAnimFrameId = requestAnimationFrame(draw);
      }

      cancelAnimationFrame(radarAnimFrameId);
      radarAnimFrameId = requestAnimationFrame(draw);
    },

    stopRadarCanvas() {
      if (radarAnimFrameId) {
        cancelAnimationFrame(radarAnimFrameId);
        radarAnimFrameId = null;
      }
    },

    showScanView() {
      const statusCard = document.getElementById('status-card');
      const scanLoggerDock = document.getElementById('scan-logger-dock');
      const emptyState = document.getElementById('empty-state');
      const wantlistManager = document.getElementById('wantlist-manager');
      const resultsGrid = document.getElementById('results-grid');
      const noResultsState = document.getElementById('no-results-state');
      const headerNavRow = document.getElementById('header-nav-row');
      const tabNavigation = document.getElementById('tab-navigation');
      const filterToolbar = document.getElementById('filter-toolbar');
      const statsView = document.getElementById('stats-view');
      const logoVinyl = document.getElementById('logo-vinyl');

      if (emptyState) emptyState.style.display = 'none';
      if (wantlistManager) wantlistManager.style.display = 'none';
      if (resultsGrid) resultsGrid.style.display = 'none';
      const resultsViewWrapper = document.getElementById('results-view-wrapper');
      if (resultsViewWrapper) resultsViewWrapper.style.display = 'none';
      const smartPurchaseCard = document.getElementById('smart-purchase-card');
      if (smartPurchaseCard) smartPurchaseCard.style.display = 'none';
      const localView = document.getElementById('local-view');
      if (localView) localView.style.display = 'none';
      const collectionView = document.getElementById('collection-view');
      if (collectionView) collectionView.style.display = 'none';
      if (noResultsState) noResultsState.style.display = 'none';
      if (headerNavRow) headerNavRow.style.display = 'none';
      if (tabNavigation) tabNavigation.style.display = 'none';
      if (filterToolbar) filterToolbar.style.display = 'none';
      if (statsView) statsView.style.display = 'none';

      if (statusCard) statusCard.style.display = 'block';
      if (scanLoggerDock) scanLoggerDock.style.display = 'block';
      if (logoVinyl) logoVinyl.classList.add('spinning');

      window.scrollTo({ top: 0, behavior: 'instant' });
      this.startRadarCanvas();
    },

    updateProgress(data) {
      const { index, total, progress, item, timeEstText, listingsCount } = data;
      const statusTitle = document.getElementById('status-title');
      const scanningEtaBadge = document.getElementById('scanning-eta-badge');
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const progressPercent = document.getElementById('progress-percent');
      const scanningTitle = document.getElementById('scanning-title');
      const scanningArtist = document.getElementById('scanning-artist');
      const scanningBadgeStep = document.getElementById('scanning-badge-step');
      const scanningPriorityTag = document.getElementById('scanning-priority-tag');
      const scanningOffersBadge = document.getElementById('scanning-offers-badge');
      const scanningCoverArt = document.getElementById('scanning-cover-art');
      const coverPlaceholder = document.getElementById('cover-placeholder');

      if (statusTitle) statusTitle.textContent = `Escaneando disco ${index + 1} de ${total}`;
      if (scanningEtaBadge) {
        const cleanEta = (timeEstText || '').replace(/^[ ·]+/, '').trim();
        scanningEtaBadge.textContent = cleanEta || 'Calculando tiempo...';
      }
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `Analizando: ${item.artist ? item.artist + ' - ' : ''}${item.title}...`;
      if (progressPercent) progressPercent.textContent = `${progress}%`;

      if (scanningTitle) scanningTitle.textContent = item.title || 'Disco sin título';
      if (scanningArtist) scanningArtist.textContent = item.artist || 'Artista';
      if (scanningBadgeStep) scanningBadgeStep.textContent = `Disco ${index + 1} de ${total}`;
      if (scanningPriorityTag) scanningPriorityTag.style.display = item.isPriority ? 'flex' : 'none';

      if (scanningOffersBadge) {
        if (listingsCount > 0) {
          scanningOffersBadge.textContent = `${listingsCount} copias en venta`;
          scanningOffersBadge.className = 'text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 px-2.5 py-0.5 rounded-full';
        } else {
          scanningOffersBadge.textContent = 'Sin copias en venta';
          scanningOffersBadge.className = 'text-[11px] font-semibold bg-stone-100 text-stone-500 border border-stone-300 px-2.5 py-0.5 rounded-full';
        }
      }

      if (scanningCoverArt) {
        const imgUrl = item.image || '';
        if (imgUrl) {
          scanningCoverArt.style.backgroundImage = `url('${imgUrl}')`;
          if (coverPlaceholder) coverPlaceholder.style.display = 'none';
        } else {
          scanningCoverArt.style.backgroundImage = '';
          if (coverPlaceholder) coverPlaceholder.style.display = 'block';
        }
      }
    },

    hideScanView() {
      const statusCard = document.getElementById('status-card');
      const scanLoggerDock = document.getElementById('scan-logger-dock');
      const logoVinyl = document.getElementById('logo-vinyl');

      if (statusCard) statusCard.style.display = 'none';
      if (scanLoggerDock) scanLoggerDock.style.display = 'none';
      if (logoVinyl) logoVinyl.classList.remove('spinning');

      this.stopRadarCanvas();
    }
  };

  global.RadarRenderer = RadarRenderer;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RadarRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);

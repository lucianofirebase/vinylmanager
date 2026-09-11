/**
 * Discogs Matcher — Motion System v2
 * Handles all JS-driven animations:
 *  - Wizard step transitions
 *  - Star burst microanimation
 *  - Modal spring physics
 *  - Scroll reveal
 *  - Network graph (Canvas)
 *  - Progressive seller reveal
 *  - Counter animation
 *  - Turntable control
 */

'use strict';

// ─────────────────────────────────────────────
// 1. WIZARD STEP TRANSITIONS
// ─────────────────────────────────────────────

/**
 * Animate between wizard steps with exit/enter transitions.
 * @param {number} from - Step number leaving (1-3)
 * @param {number} to   - Step number entering (1-3)
 */
function motionGoToStep(from, to) {
  const fromPane = document.getElementById(`step-pane-${from}`);
  const toPane   = document.getElementById(`step-pane-${to}`);
  if (!toPane) return;

  if (fromPane && fromPane !== toPane) {
    fromPane.classList.add('exit');
    fromPane.addEventListener('animationend', () => {
      fromPane.style.display = 'none';
      fromPane.classList.remove('exit');
    }, { once: true });
  }

  toPane.style.display = 'flex';
  toPane.style.flexDirection = 'column';
  toPane.style.alignItems = 'center';
  // Force reflow to restart animation
  void toPane.offsetWidth;
  toPane.style.animation = 'none';
  void toPane.offsetWidth;
  toPane.style.animation = '';
  toPane.classList.remove('exit');
}

// ─────────────────────────────────────────────
// 2. STAR BURST MICROANIMATION
// ─────────────────────────────────────────────

/**
 * Trigger golden burst particles on star toggle.
 * @param {HTMLElement} labelEl - The star label element
 * @param {boolean} isActive    - Whether star is now active
 */
function motionStarBurst(labelEl, isActive) {
  if (!isActive) return; // only burst on activation

  const burst = document.createElement('div');
  burst.className = 'star-burst';

  const PARTICLE_COUNT = 8;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * 360;
    const distance = 20 + Math.random() * 18;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * distance;
    const dy = Math.sin(rad) * distance;

    const particle = document.createElement('span');
    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);
    particle.style.animationDelay = `${Math.random() * 0.1}s`;
    burst.appendChild(particle);
  }

  labelEl.style.position = 'relative';
  labelEl.appendChild(burst);
  
  // Halo on card
  const card = labelEl.closest('.record-card-animated');
  if (card) {
    card.classList.add('priority-active');
  }

  setTimeout(() => burst.remove(), 700);
}

// ─────────────────────────────────────────────
// 3. MODAL SPRING PHYSICS
// ─────────────────────────────────────────────

/**
 * Open a modal with spring animation.
 * @param {string} modalId - The modal overlay element ID
 */
function motionOpenModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  
  overlay.style.display = 'flex';
  // Force reflow
  void overlay.offsetWidth;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * Close a modal with spring-out animation.
 * @param {string} modalId - The modal overlay element ID
 */
function motionCloseModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;

  overlay.classList.remove('open');
  overlay.classList.add('closing');

  overlay.addEventListener('animationend', () => {
    overlay.style.display = 'none';
    overlay.classList.remove('closing');
    document.body.style.overflow = '';
  }, { once: true });
}

// ─────────────────────────────────────────────
// 4. SCROLL REVEAL
// ─────────────────────────────────────────────

let scrollRevealObserver = null;

function initScrollReveal() {
  if (!window.IntersectionObserver) return;
  
  scrollRevealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          scrollRevealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.scroll-reveal').forEach((el) =>
    scrollRevealObserver.observe(el)
  );
}

/**
 * Re-observe newly added scroll-reveal elements.
 */
function observeNewScrollReveal() {
  if (!scrollRevealObserver) return;
  document.querySelectorAll('.scroll-reveal:not(.visible)').forEach((el) =>
    scrollRevealObserver.observe(el)
  );
}

// ─────────────────────────────────────────────
// 5. COUNTER ANIMATION (enhanced)
// ─────────────────────────────────────────────

/**
 * Animate a number counter from start to end with easing.
 * @param {HTMLElement|string} elOrId
 * @param {number} from
 * @param {number} to
 * @param {number} [durationMs=900]
 * @param {string} [prefix='']
 * @param {string} [suffix='']
 */
function motionAnimateCounter(elOrId, from, to, durationMs = 900, prefix = '', suffix = '') {
  const el = typeof elOrId === 'string'
    ? document.getElementById(elOrId)
    : elOrId;
  if (!el) return;

  const startTime = performance.now();
  el.classList.add('counter-animating');

  const step = (now) => {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(from + (to - from) * eased);

    el.textContent = `${prefix}${value.toLocaleString('es-UY')}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.classList.remove('counter-animating');
      el.classList.add('counter-tick');
      setTimeout(() => el.classList.remove('counter-tick'), 100);
    }
  };

  requestAnimationFrame(step);
}

// ─────────────────────────────────────────────
// 6. PROGRESSIVE SELLER REVEAL
// ─────────────────────────────────────────────

/**
 * Animate seller cards entering one-by-one with stagger.
 * @param {NodeList|Array} cards - DOM elements for seller cards
 */
function motionRevealSellers(cards) {
  const cardArray = Array.from(cards);
  cardArray.forEach((card, i) => {
    card.classList.add('seller-card-reveal');
    card.style.animationDelay = `${Math.min(i * 0.06, 1.5)}s`;
  });
}

/**
 * Animate rank badges appearing with spring.
 */
function motionRevealRankBadges() {
  document.querySelectorAll('.rank-badge').forEach((badge, i) => {
    badge.style.animationDelay = `${i * 0.07 + 0.2}s`;
    badge.classList.add('rank-badge-animate');
  });
}

// ─────────────────────────────────────────────
// 7. BENTO CARD REVEAL
// ─────────────────────────────────────────────

/**
 * Animate bento grid cards with staggered spring entrance.
 * @param {string} containerSelector
 */
function motionRevealBento(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const cards = container.querySelectorAll('.bento-card');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.animationDelay = `${i * 0.1}s`;
    card.classList.add('bento-card');
    // Force reflow
    void card.offsetWidth;
    card.style.opacity = '';
  });
}

// ─────────────────────────────────────────────
// 8. NETWORK GRAPH CANVAS (Disc → Seller)
// ─────────────────────────────────────────────

let networkAnimFrameId = null;
let networkPhase = 0;

/**
 * Draw animated connection lines between disc nodes and seller nodes.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} discNodes   [{x, y, label, color}]
 * @param {Array} sellerNodes [{x, y, label, matches, color}]
 * @param {number} progress   0 to 1 — how far the animation has progressed
 */
function motionDrawNetworkGraph(canvas, discNodes, sellerNodes, progress = 1) {
  if (!canvas) return;
  
  if (networkAnimFrameId) {
    cancelAnimationFrame(networkAnimFrameId);
    networkAnimFrameId = null;
  }

  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth  || 800;
  canvas.height = canvas.offsetHeight || 300;

  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.012;

    const drawProgress = Math.min(t / 2, progress);

    // Draw connections
    discNodes.forEach((disc, di) => {
      sellerNodes.forEach((seller, si) => {
        const lineProgress = Math.max(0, Math.min(1, (drawProgress - di * 0.05 - si * 0.03) * 3));
        if (lineProgress <= 0) return;

        const startX = disc.x * canvas.width;
        const startY = disc.y * canvas.height;
        const endX   = seller.x * canvas.width;
        const endY   = seller.y * canvas.height;

        // Draw partial line
        const cx = startX + (endX - startX) * lineProgress;
        const cy = startY + (endY - startY) * lineProgress;

        const alpha = lineProgress * 0.35 + Math.sin(t + di + si) * 0.05;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = `rgba(245, 166, 35, ${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    });

    // Draw disc nodes
    discNodes.forEach((disc, di) => {
      const nodeProgress = Math.min(1, Math.max(0, (drawProgress - di * 0.05) * 4));
      if (nodeProgress <= 0) return;

      const x = disc.x * canvas.width;
      const y = disc.y * canvas.height;
      const r = 7 * nodeProgress;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = disc.color || 'rgba(131, 85, 0, 0.8)';
      ctx.fill();

      // Pulsing ring
      const ringR = r + 4 + Math.sin(t * 1.5 + di) * 2;
      ctx.beginPath();
      ctx.arc(x, y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 166, 35, ${0.2 * nodeProgress})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw seller nodes (larger, with intensity by matches)
    sellerNodes.forEach((seller, si) => {
      const nodeProgress = Math.min(1, Math.max(0, (drawProgress - 0.3 - si * 0.08) * 4));
      if (nodeProgress <= 0) return;

      const x = seller.x * canvas.width;
      const y = seller.y * canvas.height;
      const intensity = Math.min(1, (seller.matches || 1) / 5);
      const r = (8 + intensity * 8) * nodeProgress;

      // Glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      glow.addColorStop(0, `rgba(245, 166, 35, ${0.3 * intensity * nodeProgress})`);
      glow.addColorStop(1, 'rgba(245, 166, 35, 0)');
      ctx.beginPath();
      ctx.arc(x, y, r * 2, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = seller.color || `rgba(212, 160, 23, ${0.7 + intensity * 0.3})`;
      ctx.fill();
    });

    if (t < 2.5) {
      networkAnimFrameId = requestAnimationFrame(draw);
    }
  }

  draw();
}

/**
 * Stop the network graph animation.
 */
function motionStopNetworkGraph() {
  if (networkAnimFrameId) {
    cancelAnimationFrame(networkAnimFrameId);
    networkAnimFrameId = null;
  }
}

// ─────────────────────────────────────────────
// 9. TURNTABLE CONTROL
// ─────────────────────────────────────────────

let turntableEl = null;

function motionStartTurntable() {
  turntableEl = document.getElementById('loading-turntable-container');
  if (turntableEl) {
    turntableEl.classList.add('spinning');
  }
  
  // Update cover art with golden glow
  const coverArt = document.getElementById('scanning-cover-art');
  if (coverArt) {
    coverArt.style.boxShadow = '0 0 20px rgba(245, 166, 35, 0.4), 0 0 40px rgba(245, 166, 35, 0.1)';
  }
}

function motionStopTurntable() {
  if (turntableEl) {
    turntableEl.classList.remove('spinning');
    turntableEl = null;
  }
  
  const coverArt = document.getElementById('scanning-cover-art');
  if (coverArt) {
    coverArt.style.boxShadow = '';
  }
}

/**
 * Update the scanning cover art image with a fade transition.
 * @param {string} imageUrl
 * @param {string} [title='']
 */
function motionUpdateCoverArt(imageUrl, title = '') {
  const coverArt = document.getElementById('scanning-cover-art');
  const placeholder = document.getElementById('cover-placeholder');
  if (!coverArt) return;

  coverArt.style.transition = 'opacity 0.3s ease';
  coverArt.style.opacity = '0';

  setTimeout(() => {
    if (imageUrl) {
      coverArt.style.backgroundImage = `url(${imageUrl})`;
      coverArt.style.backgroundSize = 'cover';
      coverArt.style.backgroundPosition = 'center';
      if (placeholder) placeholder.style.display = 'none';
    } else {
      coverArt.style.backgroundImage = '';
      if (placeholder) placeholder.style.display = 'block';
    }
    coverArt.style.opacity = '1';
  }, 150);
}

// ─────────────────────────────────────────────
// 10. SCAN CARD STATE TRANSITIONS
// ─────────────────────────────────────────────

function motionShowScanCard() {
  const card = document.getElementById('status-card');
  if (!card) return;

  card.style.display = 'block';
  void card.offsetWidth;
  card.classList.add('entering');
  card.addEventListener('animationend', () => card.classList.remove('entering'), { once: true });

  motionStartTurntable();
}

function motionHideScanCard() {
  const card = document.getElementById('status-card');
  if (!card) return;

  card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  card.style.opacity = '0';
  card.style.transform = 'translateY(-10px) scale(0.98)';

  setTimeout(() => {
    card.style.display = 'none';
    card.style.opacity = '';
    card.style.transform = '';
    card.style.transition = '';
  }, 420);

  motionStopTurntable();
}

// ─────────────────────────────────────────────
// 11. METRIC CARD ANIMATIONS
// ─────────────────────────────────────────────

function motionAnimateMetrics(wantsCount, sellersCount, matchesCount) {
  const metricCards = document.querySelectorAll('.metric-card-pop, [id^="metric-"]');
  metricCards.forEach((card, i) => {
    card.style.animationDelay = `${i * 0.1}s`;
    card.classList.add('metric-card-pop');
  });

  // Animate counters
  const prevWants   = parseInt(document.getElementById('metric-wants-count')?.dataset?.prev || '0');
  const prevSellers = parseInt(document.getElementById('metric-sellers-count')?.dataset?.prev || '0');
  const prevMatches = parseInt(document.getElementById('metric-matches-count')?.dataset?.prev || '0');

  motionAnimateCounter('metric-wants-count',   prevWants,   wantsCount,   1000);
  motionAnimateCounter('metric-sellers-count', prevSellers, sellersCount, 1200);
  motionAnimateCounter('metric-matches-count', prevMatches, matchesCount, 1400);

  // Store for next diff
  const wantsEl   = document.getElementById('metric-wants-count');
  const sellersEl = document.getElementById('metric-sellers-count');
  const matchesEl = document.getElementById('metric-matches-count');

  if (wantsEl)   wantsEl.dataset.prev   = wantsCount;
  if (sellersEl) sellersEl.dataset.prev = sellersCount;
  if (matchesEl) matchesEl.dataset.prev = matchesCount;
}

// ─────────────────────────────────────────────
// 12. SAVINGS REVEAL
// ─────────────────────────────────────────────

function motionRevealSavings(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.add('savings-highlight', 'savings-amount');
}

// ─────────────────────────────────────────────
// 13. SKELETON LOADERS
// ─────────────────────────────────────────────

/**
 * Replace a container's contents with organic skeleton cards.
 * @param {string} containerId
 * @param {number} count
 */
function motionShowSkeletons(containerId, count = 6) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.style.animationDelay = `${i * 0.07}s`;
    card.innerHTML = `
      <div class="skeleton-organic skeleton-img"></div>
      <div class="skeleton-organic skeleton-line long" style="animation-delay: ${i * 0.07 + 0.1}s"></div>
      <div class="skeleton-organic skeleton-line short" style="animation-delay: ${i * 0.07 + 0.2}s"></div>
    `;
    container.appendChild(card);
  }
}

// ─────────────────────────────────────────────
// 14. TAB SLIDING INDICATOR
// ─────────────────────────────────────────────

let tabIndicatorEl = null;

function initTabIndicator() {
  const tabNav = document.getElementById('tab-navigation');
  if (!tabNav) return;

  tabIndicatorEl = document.createElement('div');
  tabIndicatorEl.className = 'tab-indicator no-transition';
  tabNav.style.position = 'relative';
  tabNav.appendChild(tabIndicatorEl);

  // Position it on the active tab
  const activeTab = tabNav.querySelector('[style*="border-b-2"]') || tabNav.querySelector('button');
  if (activeTab) {
    motionMoveTabIndicator(activeTab);
    // Remove no-transition after first paint
    requestAnimationFrame(() => tabIndicatorEl.classList.remove('no-transition'));
  }
}

function motionMoveTabIndicator(tabButtonEl) {
  if (!tabIndicatorEl || !tabButtonEl) return;
  const tabNav = document.getElementById('tab-navigation');
  if (!tabNav) return;

  const tabRect = tabButtonEl.getBoundingClientRect();
  const navRect = tabNav.getBoundingClientRect();

  tabIndicatorEl.style.left  = `${tabRect.left - navRect.left}px`;
  tabIndicatorEl.style.width = `${tabRect.width}px`;
}

// ─────────────────────────────────────────────
// 15. INIT — wire up everything
// ─────────────────────────────────────────────

function initMotionSystem() {
  // Scroll reveal
  initScrollReveal();

  // Modal open/close with spring
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    const closeBtns = overlay.querySelectorAll('[id*="close"]');
    closeBtns.forEach((btn) => {
      btn.addEventListener('click', () => motionCloseModal(overlay.id));
    });

    // Click backdrop to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) motionCloseModal(overlay.id);
    });
  });

  // Add scroll-reveal class to main sections that don't already have it
  const revealTargets = [
    '#smart-purchase-card',
    '#results-grid',
    '#stats-view',
  ];
  revealTargets.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.classList.add('scroll-reveal');
  });

  // Tab indicator
  initTabIndicator();

  // Wire tab clicks to indicator
  const tabBtns = document.querySelectorAll('#tab-navigation button');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => motionMoveTabIndicator(btn));
  });

  // Sticky bottom bar entrance
  const stickyBar = document.querySelector('.sticky.bottom-4');
  if (stickyBar) stickyBar.classList.add('sticky-action-bar');

  // Scan button shimmer state machine
  const scanBtns = [
    document.getElementById('start-scan-btn'),
    document.getElementById('manager-start-scan-btn'),
    document.getElementById('manager-start-scan-top-btn'),
  ];
  scanBtns.forEach((btn) => {
    if (!btn) return;
    btn.classList.add('scan-btn-idle');
    btn.addEventListener('click', () => {
      btn.classList.add('scan-btn-active');
    });
  });
}

// ─────────────────────────────────────────────
// 16. PATCH: Wire Star Bursts into existing card logic
// ─────────────────────────────────────────────

/**
 * Call this after renderWantsListInManager() to patch in burst effects.
 */
function motionPatchStarCards() {
  const grid = document.getElementById('wants-list-grid');
  if (!grid) return;

  grid.querySelectorAll('.record-card-animated').forEach((card) => {
    const label = card.querySelector('label');
    if (!label || label._motionPatched) return;
    label._motionPatched = true;

    label.addEventListener('click', () => {
      const isActive = card.classList.contains('ring-2');
      // isActive here refers to AFTER the toggle which happens in main code
      setTimeout(() => {
        const nowActive = card.classList.contains('ring-2');
        motionStarBurst(label, nowActive);
        if (nowActive) {
          card.classList.add('priority-active');
        } else {
          card.classList.remove('priority-active');
        }
      }, 10);
    });
  });
}

// Export to global scope for dashboard.js to use
window.Motion = {
  goToStep:        motionGoToStep,
  starBurst:       motionStarBurst,
  openModal:       motionOpenModal,
  closeModal:      motionCloseModal,
  animateCounter:  motionAnimateCounter,
  revealSellers:   motionRevealSellers,
  revealRankBadges:motionRevealRankBadges,
  revealBento:     motionRevealBento,
  drawNetworkGraph:motionDrawNetworkGraph,
  stopNetworkGraph:motionStopNetworkGraph,
  startTurntable:  motionStartTurntable,
  stopTurntable:   motionStopTurntable,
  updateCoverArt:  motionUpdateCoverArt,
  showScanCard:    motionShowScanCard,
  hideScanCard:    motionHideScanCard,
  animateMetrics:  motionAnimateMetrics,
  revealSavings:   motionRevealSavings,
  showSkeletons:   motionShowSkeletons,
  patchStarCards:  motionPatchStarCards,
  initTabIndicator:initTabIndicator,
  moveTabIndicator:motionMoveTabIndicator,
  init:            initMotionSystem,
};

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMotionSystem);
} else {
  initMotionSystem();
}

/**
 * Vinyl Stock Manager • UI Router (js/ui/router.js)
 * Manages view switching between Wantlist Manager, Sellers Directory,
 * Stats Dashboard, Local Sheet matcher, and Collection views.
 */

(function(global) {
  'use strict';

  const AppRouter = {
    currentTab: 'sellers',
    currentView: 'wants',

    switchTab(tabName, pushHistory = false) {
      this.currentTab = tabName;
      if (global.state) global.state.currentTab = tabName;
      if (global.appStore) global.appStore.setState({ currentTab: tabName });

      const tabBtnSellers = document.getElementById('tab-btn-sellers');
      const tabBtnLocal = document.getElementById('tab-btn-local');
      const tabBtnStats = document.getElementById('tab-btn-stats');
      const tabBtnCollection = document.getElementById('tab-btn-collection');
      const btnBackToWants = document.getElementById('btn-back-to-wants');

      const resultsGrid = document.getElementById('results-grid');
      const statsView = document.getElementById('stats-view');
      const localView = document.getElementById('local-view');
      const collectionView = document.getElementById('collection-view');
      const smartPurchaseCard = document.getElementById('smart-purchase-card');
      const resultsViewWrapper = document.getElementById('results-view-wrapper');

      const buttons = [
        { name: 'sellers', el: tabBtnSellers },
        { name: 'local', el: tabBtnLocal },
        { name: 'stats', el: tabBtnStats },
        { name: 'collection', el: tabBtnCollection }
      ];

      let activeBtnEl = null;

      buttons.forEach(({ name, el }) => {
        if (!el) return;
        const isActive = tabName === name;
        el.classList.toggle('active', isActive);
        if (isActive) {
          activeBtnEl = el;
          el.className = 'bg-prada-blue-night text-pure-white px-4 py-1.5 font-semibold border-b-2 border-prada-red tracking-wider cursor-pointer';
        } else {
          el.className = 'px-4 py-1.5 text-muted-graphite hover:text-pitch-black hover:border-hairline-dark border border-transparent transition-all font-medium cursor-pointer';
        }
      });

      if (btnBackToWants) {
        btnBackToWants.className = 'px-4 py-2 text-muted-graphite hover:text-pitch-black hover:border-hairline-dark border border-transparent transition-all font-semibold cursor-pointer';
        btnBackToWants.classList.remove('active');
      }

      if (activeBtnEl) {
        requestAnimationFrame(() => {
          if (typeof global.motionMoveTabIndicator === 'function') {
            global.motionMoveTabIndicator(activeBtnEl);
          } else if (global.Motion?.moveTabIndicator) {
            global.Motion.moveTabIndicator(activeBtnEl);
          }
        });
      }

      if (resultsGrid) resultsGrid.style.display = tabName === 'sellers' ? 'flex' : 'none';
      if (resultsViewWrapper) resultsViewWrapper.style.display = tabName === 'sellers' ? 'flex' : 'none';
      if (smartPurchaseCard) smartPurchaseCard.style.display = tabName === 'sellers' ? 'block' : 'none';

      if (statsView) {
        statsView.style.display = tabName === 'stats' ? 'flex' : 'none';
        if (tabName === 'stats' && typeof global.calculateAndRenderStats === 'function') {
          global.calculateAndRenderStats();
        }
      }

      if (localView) {
        localView.style.display = tabName === 'local' ? 'block' : 'none';
        if (tabName === 'local' && typeof global.renderLocalMatches === 'function') {
          global.renderLocalMatches();
        }
      }

      if (collectionView) {
        collectionView.style.display = tabName === 'collection' ? 'block' : 'none';
        if (tabName === 'collection' && typeof global.renderCollectionView === 'function') {
          global.renderCollectionView();
        }
      }
    },

    showWantlistManager() {
      const wantlistManager = document.getElementById('wantlist-manager');
      const emptyState = document.getElementById('empty-state');
      const resultsGrid = document.getElementById('results-grid');
      const statsView = document.getElementById('stats-view');
      const statusCard = document.getElementById('status-card');

      if (emptyState) emptyState.style.display = 'none';
      if (resultsGrid) resultsGrid.style.display = 'none';
      if (statsView) statsView.style.display = 'none';
      if (statusCard) statusCard.style.display = 'none';
      if (wantlistManager) wantlistManager.style.display = 'block';

      if (global.WantsGridRenderer) {
        global.WantsGridRenderer.renderWantsListInManager();
      }
    }
  };

  global.AppRouter = AppRouter;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppRouter;
  }
})(typeof window !== 'undefined' ? window : globalThis);

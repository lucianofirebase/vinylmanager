// monitor.js — Datadog / Rancher Style Observability Console Controller
// Real-time telemetry, log streaming, faceted filtering, and cluster metrics.

(function () {
  const FIREBASE_PROJECT_ID = 'vinylstockmanager';
  const FIREBASE_API_KEY = 'AIzaSyDOcnNy0PtJz8HnbMWD0fs2ti2TRf3ieCI';
  const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/app_logs`;

  // Application State
  const state = {
    allLogs: [],
    filteredLogs: [],
    selectedLog: null,
    filters: {
      level: 'ALL',
      device: null,
      user: null,
      action: null,
      search: ''
    },
    autoScroll: true,
    wrapLines: false,
    refreshIntervalMs: 30000,
    timerId: null,
    isFetching: false
  };

  // DOM Elements
  const el = {
    logsContainer: document.getElementById('logs-container'),
    noLogsState: document.getElementById('no-logs-state'),
    logCountIndicator: document.getElementById('log-count-indicator'),
    activeFilterTag: document.getElementById('active-filter-tag'),
    btnResetAllFilters: document.getElementById('btn-reset-all-filters'),
    btnEmptyResetFilters: document.getElementById('btn-empty-reset-filters'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    selectRefreshRate: document.getElementById('select-refresh-rate'),
    btnManualRefresh: document.getElementById('btn-manual-refresh'),
    refreshIcon: document.getElementById('refresh-icon'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnPurgeLogs: document.getElementById('btn-purge-logs'),
    checkAutoScroll: document.getElementById('check-auto-scroll'),
    checkWrapLines: document.getElementById('check-wrap-lines'),
    clusterStatusText: document.getElementById('cluster-status-text'),

    // Top Metrics
    metricTotalEvents: document.getElementById('metric-total-events'),
    metricRate: document.getElementById('metric-rate'),
    metricUniqueDevices: document.getElementById('metric-unique-devices'),
    metricDeviceBadges: document.getElementById('metric-device-badges'),
    metricDeviceSubtext: document.getElementById('metric-device-subtext'),
    metricUniqueUsers: document.getElementById('metric-unique-users'),
    metricUsersSubtext: document.getElementById('metric-users-subtext'),
    metricErrorCount: document.getElementById('metric-error-count'),
    metricHealthBadge: document.getElementById('metric-health-badge'),

    // Facet sidebars
    facetLevelList: document.getElementById('facet-level-list'),
    facetDeviceList: document.getElementById('facet-device-list'),
    facetUserList: document.getElementById('facet-user-list'),
    facetActionList: document.getElementById('facet-action-list'),
    btnClearLevelFilter: document.getElementById('btn-clear-level-filter'),
    btnClearDeviceFilter: document.getElementById('btn-clear-device-filter'),
    btnClearUserFilter: document.getElementById('btn-clear-user-filter'),
    btnClearActionFilter: document.getElementById('btn-clear-action-filter'),

    // Drawer Elements
    drawer: document.getElementById('log-details-drawer'),
    drawerLevelBadge: document.getElementById('drawer-level-badge'),
    drawerTitle: document.getElementById('drawer-title'),
    drawerMessage: document.getElementById('drawer-message'),
    drawerAction: document.getElementById('drawer-action'),
    drawerUser: document.getElementById('drawer-user'),
    drawerDevice: document.getElementById('drawer-device'),
    drawerMode: document.getElementById('drawer-mode'),
    drawerScreen: document.getElementById('drawer-screen'),
    drawerDeviceId: document.getElementById('drawer-device-id'),
    drawerSessionId: document.getElementById('drawer-session-id'),
    drawerTimestamp: document.getElementById('drawer-timestamp'),
    drawerDetailsPre: document.getElementById('drawer-details-pre'),
    drawerRawJson: document.getElementById('drawer-raw-json'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    btnCopyRawJson: document.getElementById('btn-copy-raw-json'),
    btnDeleteSingleLog: document.getElementById('btn-delete-single-log'),

    // Purge Modal
    modalPurgeConfirm: document.getElementById('modal-purge-confirm'),
    btnCancelPurge: document.getElementById('btn-cancel-purge'),
    btnConfirmPurge: document.getElementById('btn-confirm-purge'),

    // Toasts
    toastContainer: document.getElementById('toast-container')
  };

  // Format date helper
  function formatTimestamp(isoStr) {
    if (!isoStr) return { time: '—', date: '—', relative: '—' };
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return { time: isoStr, date: '', relative: '' };

    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${mins}:${secs}`;
    const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    let relative = '';
    if (diffSec < 5) relative = 'ahora';
    else if (diffSec < 60) relative = `hace ${diffSec}s`;
    else if (diffSec < 3600) relative = `hace ${Math.floor(diffSec / 60)}m`;
    else if (diffSec < 86400) relative = `hace ${Math.floor(diffSec / 3600)}h`;
    else relative = `hace ${Math.floor(diffSec / 86400)}d`;

    return { time: timeStr, date: dateStr, relative };
  }

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Level Styling
  function getLevelBadgeStyle(level) {
    const l = (level || 'info').toLowerCase();
    switch (l) {
      case 'action':
        return 'bg-purple-950/70 text-purple-300 border border-purple-700/60 font-bold';
      case 'error':
        return 'bg-rose-950/70 text-rose-300 border border-rose-700/60 font-bold';
      case 'warn':
      case 'warning':
        return 'bg-amber-950/70 text-amber-300 border border-amber-700/60 font-bold';
      case 'success':
        return 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-bold';
      case 'info':
      default:
        return 'bg-cyan-950/70 text-cyan-300 border border-cyan-700/60 font-bold';
    }
  }

  // Device Icon
  function getDeviceIcon(label = '') {
    if (/iPhone|iPad|iOS/i.test(label)) return '📱';
    if (/Android/i.test(label)) return '🤖';
    if (/Extension/i.test(label)) return '🧩';
    if (/Mac/i.test(label)) return '🍎';
    if (/Windows/i.test(label)) return '💻';
    return '🌐';
  }

  // Toast System
  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-lg border text-xs font-mono shadow-2xl flex items-center space-x-2 transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0 ${
      type === 'error'
        ? 'bg-rose-950 text-rose-200 border-rose-800'
        : type === 'success'
        ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
        : 'bg-datadog-card text-slate-200 border-datadog-border'
    }`;

    const icon = type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info';
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[16px]">${icon}</span>
      <span>${escapeHtml(msg)}</span>
    `;

    el.toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  let quotaToastShown = false;
  function handleQuotaExceeded() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (el.selectRefreshRate) {
      el.selectRefreshRate.value = '0';
    }
    el.clusterStatusText.textContent = 'MODO CACHÉ (CUOTA 429)';
    el.clusterStatusText.className = 'text-amber-400 font-mono text-[11px] font-bold';

    // Try loading cached logs from localStorage
    try {
      const cached = localStorage.getItem('monitor_cached_logs');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.allLogs = parsed;
          applyFiltersAndRender();
          updateMetrics();
          updateFacets();
        }
      }
    } catch (e) {}

    if (!quotaToastShown) {
      quotaToastShown = true;
      showToast('⚠️ Cuota diaria de Firebase alcanzada (50k lecturas). Mostrando datos guardados en caché.', 'warning');
    }
  }

  // Fetch Firestore Documents
  async function fetchLogs() {
    if (state.isFetching) return;
    state.isFetching = true;
    el.refreshIcon.classList.add('animate-spin');

    try {
      const runQueryEndpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
      const payload = {
        structuredQuery: {
          from: [{ collectionId: 'app_logs' }],
          orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
          limit: 60
        }
      };

      const response = await fetch(runQueryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429) {
          handleQuotaExceeded();
          return;
        }
        throw new Error(`Error HTTP ${response.status} al consultar Firestore`);
      }

      const queryResults = await response.json();
      const rawDocs = (Array.isArray(queryResults) ? queryResults : [])
        .filter((item) => item.document && item.document.fields)
        .map((item) => item.document);

      // Parse documents
      state.allLogs = rawDocs.map((doc) => {
        const f = doc.fields || {};
        let action = f.action?.stringValue;
        const msg = f.message?.stringValue || '';
        const level = (f.level?.stringValue || 'info').toLowerCase();
        if (!action) {
          if (msg.includes('Wantlist')) action = 'WANTLIST_LOAD';
          else if (msg.includes('Sesión iniciada')) action = 'APP_OPENED';
          else if (msg.includes('Iniciando')) action = 'APP_INIT';
          else if (level === 'error') action = 'ERROR';
          else action = 'LOG';
        }

        const rawTs = f.timestamp?.timestampValue || f.timestamp?.stringValue || doc.createTime || new Date().toISOString();

        return {
          id: doc.name.split('/').pop(),
          docName: doc.name,
          action: action.toUpperCase(),
          deviceId: f.deviceId?.stringValue || 'dev_unknown',
          deviceLabel: f.deviceLabel?.stringValue || 'Dispositivo Web',
          os: f.os?.stringValue || 'Desconocido',
          browser: f.browser?.stringValue || 'Navegador',
          mode: f.mode?.stringValue || 'Web App',
          screen: f.screen?.stringValue || '—',
          sessionId: f.sessionId?.stringValue || 'sess_none',
          username: f.username?.stringValue || 'INVITADO',
          level: level,
          message: msg,
          details: f.details?.stringValue || '',
          url: f.url?.stringValue || '',
          timestamp: rawTs,
          rawDoc: doc
        };
      }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Persist logs in localStorage for offline / quota fallback
      try {
        localStorage.setItem('monitor_cached_logs', JSON.stringify(state.allLogs));
      } catch (e) {}

      // Update Cluster Status
      el.clusterStatusText.textContent = `LIVE CLUSTER (${state.allLogs.length})`;
      el.clusterStatusText.className = 'text-emerald-400 font-mono text-[11px] font-bold';

      // Apply current filters and re-render
      applyFiltersAndRender();
      updateMetrics();
      updateFacets();
    } catch (err) {
      if (err.message && err.message.includes('429')) {
        handleQuotaExceeded();
        return;
      }
      console.error('[Vinyl Ops Monitor] Error al obtener telemetría:', err);
      showToast(`Error de conexión: ${err.message}`, 'error');
      el.clusterStatusText.textContent = 'ERROR DE CONEXIÓN';
    } finally {
      state.isFetching = false;
      el.refreshIcon.classList.remove('animate-spin');
    }
  }

  // Update Top Metrics Cards
  function updateMetrics() {
    const total = state.allLogs.length;
    el.metricTotalEvents.textContent = total;

    // Calculate events in the last hour
    const now = Date.now();
    const recent = state.allLogs.filter(l => now - new Date(l.timestamp).getTime() < 3600000);
    const ratePerMin = (recent.length / 60).toFixed(1);
    el.metricRate.textContent = `${ratePerMin} ev/min`;

    // Unique Devices & Breakdown
    const devicesMap = {};
    let iphoneCount = 0;
    let desktopCount = 0;
    state.allLogs.forEach(l => {
      devicesMap[l.deviceId] = l.deviceLabel;
      if (/iPhone|iPad|iOS/i.test(l.deviceLabel)) iphoneCount++;
      else desktopCount++;
    });
    const uniqueDevicesCount = Object.keys(devicesMap).length;
    el.metricUniqueDevices.textContent = uniqueDevicesCount;
    el.metricDeviceBadges.textContent = `${iphoneCount} iOS • ${desktopCount} PC`;
    el.metricDeviceSubtext.textContent = uniqueDevicesCount === 0 ? 'Sin datos' : `${Object.values(devicesMap)[0] || ''}`;

    // Unique Users
    const usersSet = new Set();
    state.allLogs.forEach(l => {
      if (l.username && l.username !== 'INVITADO') usersSet.add(l.username);
    });
    el.metricUniqueUsers.textContent = usersSet.size;
    if (usersSet.size > 0) {
      el.metricUsersSubtext.textContent = Array.from(usersSet).slice(0, 3).join(', ');
    } else {
      el.metricUsersSubtext.textContent = 'Solo invitados o pruebas';
    }

    // Health & Errors
    const errors = state.allLogs.filter(l => l.level === 'error');
    el.metricErrorCount.textContent = errors.length;
    if (total === 0) {
      el.metricHealthBadge.textContent = '100% OK';
      el.metricHealthBadge.className = 'text-[10.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40';
    } else {
      const healthPct = Math.max(0, Math.round(((total - errors.length) / total) * 100));
      el.metricHealthBadge.textContent = `${healthPct}% OK`;
      if (healthPct < 90) {
        el.metricHealthBadge.className = 'text-[10.5px] font-mono px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-400 border border-rose-800/40';
      } else {
        el.metricHealthBadge.className = 'text-[10.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40';
      }
    }
  }

  // Update Faceted Sidebar Counters
  function updateFacets() {
    // Level Counts
    const counts = { all: state.allLogs.length, action: 0, info: 0, warn: 0, error: 0 };
    const deviceCounts = {};
    const userCounts = {};
    const actionCounts = {};

    state.allLogs.forEach(l => {
      if (counts[l.level] !== undefined) counts[l.level]++;
      else counts.info++;

      deviceCounts[l.deviceLabel] = (deviceCounts[l.deviceLabel] || 0) + 1;
      userCounts[l.username] = (userCounts[l.username] || 0) + 1;
      actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
    });

    // Update level facet badge counts
    const countAll = document.getElementById('facet-count-all');
    const countAction = document.getElementById('facet-count-action');
    const countInfo = document.getElementById('facet-count-info');
    const countWarn = document.getElementById('facet-count-warn');
    const countError = document.getElementById('facet-count-error');

    if (countAll) countAll.textContent = counts.all;
    if (countAction) countAction.textContent = counts.action;
    if (countInfo) countInfo.textContent = counts.info;
    if (countWarn) countWarn.textContent = counts.warn;
    if (countError) countError.textContent = counts.error;

    // Render Device Facets
    renderFacetList(el.facetDeviceList, deviceCounts, state.filters.device, (val) => {
      state.filters.device = state.filters.device === val ? null : val;
      el.btnClearDeviceFilter.style.display = state.filters.device ? 'inline' : 'none';
      applyFiltersAndRender();
    });

    // Render User Facets
    renderFacetList(el.facetUserList, userCounts, state.filters.user, (val) => {
      state.filters.user = state.filters.user === val ? null : val;
      el.btnClearUserFilter.style.display = state.filters.user ? 'inline' : 'none';
      applyFiltersAndRender();
    });

    // Render Action Facets
    renderFacetList(el.facetActionList, actionCounts, state.filters.action, (val) => {
      state.filters.action = state.filters.action === val ? null : val;
      el.btnClearActionFilter.style.display = state.filters.action ? 'inline' : 'none';
      applyFiltersAndRender();
    });
  }

  // Generic Facet List Builder
  function renderFacetList(container, dataMap, activeVal, onSelect) {
    if (!container) return;
    const entries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      container.innerHTML = '<p class="text-[11px] text-slate-500 italic px-2">Sin registros</p>';
      return;
    }

    container.innerHTML = '';
    entries.forEach(([name, count]) => {
      const btn = document.createElement('button');
      const isActive = activeVal === name;
      btn.className = `w-full flex items-center justify-between px-2 py-1 rounded transition text-left ${
        isActive
          ? 'bg-purple-950/80 border border-purple-600 text-purple-200'
          : 'hover:bg-datadog-card text-slate-300'
      }`;

      btn.innerHTML = `
        <span class="truncate max-w-[150px] flex items-center gap-1.5" title="${escapeHtml(name)}">
          ${getDeviceIcon(name)}
          <span class="truncate">${escapeHtml(name)}</span>
        </span>
        <span class="text-[10px] font-mono ${isActive ? 'text-purple-300' : 'text-slate-500'}">${count}</span>
      `;

      btn.addEventListener('click', () => onSelect(name));
      container.appendChild(btn);
    });
  }

  // Apply Current Filters and Render Logs
  function applyFiltersAndRender() {
    const q = state.filters.search.toLowerCase().trim();

    state.filteredLogs = state.allLogs.filter((log) => {
      // Level Filter
      if (state.filters.level !== 'ALL' && log.level !== state.filters.level.toLowerCase()) {
        return false;
      }
      // Device Filter
      if (state.filters.device && log.deviceLabel !== state.filters.device) {
        return false;
      }
      // User Filter
      if (state.filters.user && log.username !== state.filters.user) {
        return false;
      }
      // Action Filter
      if (state.filters.action && log.action !== state.filters.action) {
        return false;
      }
      // Search Query
      if (q) {
        const fullSearchableText = `${log.action} ${log.username} ${log.deviceLabel} ${log.message} ${log.details} ${log.level}`.toLowerCase();
        if (!fullSearchableText.includes(q)) return false;
      }

      return true;
    });

    // Update Counter & Active Filter Badge
    const hasActiveFilters =
      state.filters.level !== 'ALL' ||
      !!state.filters.device ||
      !!state.filters.user ||
      !!state.filters.action ||
      !!q;

    el.logCountIndicator.innerHTML = `Mostrando <strong class="text-white">${state.filteredLogs.length}</strong> de ${state.allLogs.length} eventos`;
    el.activeFilterTag.style.display = hasActiveFilters ? 'inline-flex' : 'none';

    renderLogRows();
  }

  // Render Log Rows into Table
  function renderLogRows() {
    if (state.filteredLogs.length === 0) {
      el.logsContainer.innerHTML = '';
      el.noLogsState.classList.remove('hidden');
      return;
    }

    el.noLogsState.classList.add('hidden');
    el.logsContainer.innerHTML = '';

    const q = state.filters.search.toLowerCase().trim();

    state.filteredLogs.forEach((log) => {
      const row = document.createElement('div');
      const isSelected = state.selectedLog && state.selectedLog.id === log.id;
      row.className = `log-row px-4 py-2 cursor-pointer grid grid-cols-12 gap-2 items-center text-[11.5px] font-mono border-b border-datadog-border/40 ${
        isSelected ? 'selected' : ''
      }`;
      row.dataset.logId = log.id;

      const ts = formatTimestamp(log.timestamp);
      const levelStyle = getLevelBadgeStyle(log.level);
      const devIcon = getDeviceIcon(log.deviceLabel);

      let msgHtml = escapeHtml(log.message);
      if (q && msgHtml.toLowerCase().includes(q)) {
        const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        msgHtml = msgHtml.replace(regex, '<mark class="bg-purple-600/60 text-white rounded px-0.5">$1</mark>');
      }

      const wrapClass = state.wrapLines ? 'whitespace-normal break-words' : 'truncate';

      row.innerHTML = `
        <div class="col-span-2 sm:col-span-2 text-slate-400 flex flex-col justify-center">
          <span class="font-bold text-slate-200">${ts.time}</span>
          <span class="text-[9.5px] text-slate-500">${ts.relative} • ${ts.date}</span>
        </div>
        <div class="col-span-2 sm:col-span-1">
          <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${levelStyle}">
            ${escapeHtml(log.level)}
          </span>
        </div>
        <div class="col-span-3 sm:col-span-2 text-slate-300 flex items-center gap-1.5 truncate" title="${escapeHtml(log.deviceLabel)}">
          <span>${devIcon}</span>
          <span class="truncate">${escapeHtml(log.deviceLabel)}</span>
        </div>
        <div class="col-span-2 sm:col-span-2 text-emerald-400 font-bold truncate flex items-center gap-1" title="${escapeHtml(log.username)}">
          <span class="text-emerald-500 text-[10px]">@</span>
          <span class="truncate">${escapeHtml(log.username)}</span>
        </div>
        <div class="col-span-3 sm:col-span-5 flex items-center space-x-2 overflow-hidden">
          <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40 shrink-0 font-bold">
            ${escapeHtml(log.action)}
          </span>
          <span class="text-slate-300 ${wrapClass} flex-1 font-sans text-xs">
            ${msgHtml}
          </span>
        </div>
      `;

      row.addEventListener('click', () => openLogDrawer(log, row));
      el.logsContainer.appendChild(row);
    });

    if (state.autoScroll) {
      el.logsContainer.scrollTop = 0;
    }
  }

  // Open Log Details Drawer
  function openLogDrawer(log, rowEl) {
    state.selectedLog = log;

    // Highlight active row
    document.querySelectorAll('.log-row.selected').forEach((r) => r.classList.remove('selected'));
    if (rowEl) rowEl.classList.add('selected');

    // Populate Drawer
    el.drawerLevelBadge.textContent = log.level.toUpperCase();
    el.drawerLevelBadge.className = `px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${getLevelBadgeStyle(log.level)}`;
    el.drawerTitle.textContent = log.action || 'Detalle del Evento';

    el.drawerMessage.textContent = log.message;
    el.drawerAction.textContent = log.action;
    el.drawerUser.textContent = `@${log.username}`;
    el.drawerDevice.textContent = `${getDeviceIcon(log.deviceLabel)} ${log.deviceLabel}`;
    el.drawerMode.textContent = log.mode;
    el.drawerScreen.textContent = log.screen;
    el.drawerDeviceId.textContent = log.deviceId;
    el.drawerSessionId.textContent = log.sessionId;
    el.drawerTimestamp.textContent = `${new Date(log.timestamp).toLocaleString()} (${log.timestamp})`;

    // Format details JSON or text
    let formattedDetails = log.details;
    try {
      if (typeof log.details === 'string' && (log.details.startsWith('{') || log.details.startsWith('['))) {
        formattedDetails = JSON.stringify(JSON.parse(log.details), null, 2);
      }
    } catch (e) {}

    el.drawerDetailsPre.textContent = formattedDetails || '(Sin parámetros adicionales)';
    el.drawerRawJson.textContent = JSON.stringify(log.rawDoc, null, 2);

    el.drawer.classList.remove('hidden');
  }

  // Close Drawer
  function closeDrawer() {
    el.drawer.classList.add('hidden');
    state.selectedLog = null;
    document.querySelectorAll('.log-row.selected').forEach((r) => r.classList.remove('selected'));
  }

  // Delete Single Log Document
  async function deleteSingleLog() {
    if (!state.selectedLog) return;
    const docName = state.selectedLog.docName;
    const endpoint = `https://firestore.googleapis.com/v1/${docName}?key=${FIREBASE_API_KEY}`;

    try {
      const resp = await fetch(endpoint, { method: 'DELETE' });
      if (resp.ok) {
        showToast('Registro eliminado con éxito', 'success');
        closeDrawer();
        fetchLogs();
      } else {
        showToast('No se pudo eliminar el registro', 'error');
      }
    } catch (e) {
      showToast(`Error al eliminar: ${e.message}`, 'error');
    }
  }

  // Purge All Logs
  async function purgeAllLogs() {
    el.modalPurgeConfirm.classList.add('hidden');
    showToast('Iniciando limpieza de registros en Firestore...', 'info');

    try {
      const deletePromises = state.allLogs.map((log) => {
        const endpoint = `https://firestore.googleapis.com/v1/${log.docName}?key=${FIREBASE_API_KEY}`;
        return fetch(endpoint, { method: 'DELETE' }).catch(() => null);
      });

      await Promise.all(deletePromises);
      showToast('¡Colección app_logs limpiada con éxito!', 'success');
      fetchLogs();
    } catch (e) {
      showToast(`Error durante la purga: ${e.message}`, 'error');
    }
  }

  // Export Logs to JSON File
  function exportLogsToJson() {
    const dataStr = JSON.stringify(state.filteredLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vinyl_ops_telemetry_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exportados ${state.filteredLogs.length} eventos a JSON`, 'success');
  }

  // Reset all filters
  function resetAllFilters() {
    state.filters = {
      level: 'ALL',
      device: null,
      user: null,
      action: null,
      search: ''
    };
    el.searchInput.value = '';
    el.btnClearSearch.classList.add('hidden');
    el.btnClearLevelFilter.style.display = 'none';
    el.btnClearDeviceFilter.style.display = 'none';
    el.btnClearUserFilter.style.display = 'none';
    el.btnClearActionFilter.style.display = 'none';

    // Reset level facet buttons
    document.querySelectorAll('.facet-level-btn').forEach((b) => {
      if (b.dataset.level === 'ALL') {
        b.className = 'facet-level-btn w-full flex items-center justify-between px-2 py-1 rounded bg-datadog-card border border-datadog-purple text-purple-300';
      } else {
        b.className = 'facet-level-btn w-full flex items-center justify-between px-2 py-1 rounded hover:bg-datadog-card text-slate-300';
      }
    });

    applyFiltersAndRender();
  }

  // Setup Refresh Timer
  function setupRefreshTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }

    if (state.refreshIntervalMs > 0) {
      state.timerId = setInterval(() => {
        fetchLogs();
      }, state.refreshIntervalMs);
    }
  }

  // Setup Event Listeners
  function initEventListeners() {
    // Refresh interval selector
    el.selectRefreshRate.addEventListener('change', (e) => {
      state.refreshIntervalMs = parseInt(e.target.value, 10);
      setupRefreshTimer();
      if (state.refreshIntervalMs === 0) {
        showToast('Transmisión en vivo pausada', 'info');
      } else {
        showToast(`Refresco automático cada ${state.refreshIntervalMs / 1000}s`, 'info');
      }
    });

    // Manual Refresh
    el.btnManualRefresh.addEventListener('click', () => {
      fetchLogs();
      showToast('Actualizando eventos...', 'info');
    });

    // Search Query input
    el.searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      if (state.filters.search) {
        el.btnClearSearch.classList.remove('hidden');
      } else {
        el.btnClearSearch.classList.add('hidden');
      }
      applyFiltersAndRender();
    });

    // Clear search
    el.btnClearSearch.addEventListener('click', () => {
      el.searchInput.value = '';
      state.filters.search = '';
      el.btnClearSearch.classList.add('hidden');
      applyFiltersAndRender();
    });

    // Keyboard shortcut for search
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
      }
      if (e.key === 'Escape') {
        closeDrawer();
        el.modalPurgeConfirm.classList.add('hidden');
      }
    });

    // Level facet buttons
    document.querySelectorAll('.facet-level-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lvl = btn.dataset.level;
        state.filters.level = lvl;

        document.querySelectorAll('.facet-level-btn').forEach((b) => {
          if (b === btn) {
            b.className = 'facet-level-btn w-full flex items-center justify-between px-2 py-1 rounded bg-datadog-card border border-datadog-purple text-purple-300';
          } else {
            b.className = 'facet-level-btn w-full flex items-center justify-between px-2 py-1 rounded hover:bg-datadog-card text-slate-300';
          }
        });

        el.btnClearLevelFilter.style.display = lvl !== 'ALL' ? 'inline' : 'none';
        applyFiltersAndRender();
      });
    });

    // Clear level filter button
    el.btnClearLevelFilter.addEventListener('click', () => {
      state.filters.level = 'ALL';
      document.querySelector('.facet-level-btn[data-level="ALL"]')?.click();
    });

    // Clear device filter
    el.btnClearDeviceFilter.addEventListener('click', () => {
      state.filters.device = null;
      el.btnClearDeviceFilter.style.display = 'none';
      applyFiltersAndRender();
      updateFacets();
    });

    // Clear user filter
    el.btnClearUserFilter.addEventListener('click', () => {
      state.filters.user = null;
      el.btnClearUserFilter.style.display = 'none';
      applyFiltersAndRender();
      updateFacets();
    });

    // Clear action filter
    el.btnClearActionFilter.addEventListener('click', () => {
      state.filters.action = null;
      el.btnClearActionFilter.style.display = 'none';
      applyFiltersAndRender();
      updateFacets();
    });

    // Reset all filters
    el.btnResetAllFilters.addEventListener('click', resetAllFilters);
    el.btnEmptyResetFilters.addEventListener('click', resetAllFilters);

    // Auto-scroll checkbox
    el.checkAutoScroll.addEventListener('change', (e) => {
      state.autoScroll = e.target.checked;
    });

    // Wrap lines checkbox
    el.checkWrapLines.addEventListener('change', (e) => {
      state.wrapLines = e.target.checked;
      renderLogRows();
    });

    // Drawer controls
    el.btnCloseDrawer.addEventListener('click', closeDrawer);

    el.btnCopyRawJson.addEventListener('click', async () => {
      if (!state.selectedLog) return;
      try {
        await navigator.clipboard.writeText(JSON.stringify(state.selectedLog, null, 2));
        showToast('JSON copiado al portapapeles', 'success');
      } catch (e) {
        showToast('Error al copiar al portapapeles', 'error');
      }
    });

    el.btnDeleteSingleLog.addEventListener('click', deleteSingleLog);

    // Purge Modal Controls
    el.btnPurgeLogs.addEventListener('click', () => {
      el.modalPurgeConfirm.classList.remove('hidden');
    });

    el.btnCancelPurge.addEventListener('click', () => {
      el.modalPurgeConfirm.classList.add('hidden');
    });

    el.btnConfirmPurge.addEventListener('click', purgeAllLogs);

    // Export JSON
    el.btnExportJson.addEventListener('click', exportLogsToJson);
  }

  // Initialization
  function init() {
    // Restore cached logs immediately so view is populated instantly
    try {
      const cached = localStorage.getItem('monitor_cached_logs');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.allLogs = parsed;
          el.clusterStatusText.textContent = `MODO CACHÉ (${state.allLogs.length})`;
          applyFiltersAndRender();
          updateMetrics();
          updateFacets();
        }
      }
    } catch (e) {}

    initEventListeners();
    fetchLogs();
    setupRefreshTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// telemetry.js — Remote Telemetry and Error Tracking via Firebase Firestore
// Enables tracking logs, errors, and user activity from iPhone, web, and extensions.

(function (window) {
  const FIREBASE_PROJECT_ID = 'vinylstockmanager';
  const FIREBASE_API_KEY = 'AIzaSyDOcnNy0PtJz8HnbMWD0fs2ti2TRf3ieCI';
  const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/app_logs`;

  // Persistent anonymous device ID
  function getDeviceId() {
    let id = localStorage.getItem('telemetry_device_id');
    if (!id) {
      id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('telemetry_device_id', id);
    }
    return id;
  }

  // Session ID (resets when tab/app is closed)
  function getSessionId() {
    let sId = sessionStorage.getItem('telemetry_session_id');
    if (!sId) {
      sId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
      sessionStorage.setItem('telemetry_session_id', sId);
    }
    return sId;
  }

  // Detect device and environment
  function getDeviceInfo() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
    const isWindows = /Windows/i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const isEdge = /Edg/i.test(ua);

    let os = 'Unknown OS';
    if (isIOS) {
      if (/iPhone/.test(ua)) os = 'iPhone';
      else if (/iPad/.test(ua)) os = 'iPad';
      else os = 'iOS';
    } else if (isAndroid) {
      os = 'Android';
    } else if (isMac) {
      os = 'macOS';
    } else if (isWindows) {
      os = 'Windows';
    }

    let browser = 'Browser';
    if (isEdge) browser = 'Edge';
    else if (isChrome) browser = 'Chrome';
    else if (isSafari) browser = 'Safari';
    else if (isFirefox) browser = 'Firefox';

    const isExtension = (typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.runtime?.id);
    const mode = isExtension ? 'Chrome Extension' : 'Web App';
    const label = `${os} • ${browser} (${mode})`;

    return {
      os,
      browser,
      isExtension,
      mode,
      label,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || 'es'
    };
  }

  const device = getDeviceInfo();
  const deviceId = getDeviceId();
  const sessionId = getSessionId();

  let telemetryMutedUntil = 0;

  // Send log entry to Firestore REST endpoint
  async function sendRemoteLog(level, message, details = {}, action = 'LOG') {
    if (Date.now() < telemetryMutedUntil) return;
    try {
      const username = window.state?.username || localStorage.getItem('discogs_username') || 'INVITADO';
      const cleanMessage = String(message || '').substring(0, 800);
      let detailsStr = '';
      try {
        detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
      } catch (e) {
        detailsStr = String(details);
      }
      detailsStr = detailsStr.substring(0, 2000);

      const payload = {
        fields: {
          action: { stringValue: String(action || 'LOG').toUpperCase() },
          deviceId: { stringValue: deviceId },
          deviceLabel: { stringValue: device.label },
          os: { stringValue: device.os },
          browser: { stringValue: device.browser },
          mode: { stringValue: device.mode },
          screen: { stringValue: `${window.innerWidth || 0}x${window.innerHeight || 0}` },
          sessionId: { stringValue: sessionId },
          username: { stringValue: username },
          level: { stringValue: level || 'info' },
          message: { stringValue: cleanMessage },
          details: { stringValue: detailsStr },
          url: { stringValue: (window.location?.href || '').substring(0, 250) },
          timestamp: { timestampValue: new Date().toISOString() }
        }
      };

      const endpoint = `${BASE_URL}?key=${FIREBASE_API_KEY}`;
      
      // Fire-and-forget fetch without blocking UI
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(res => {
        if (res.status === 429) {
          telemetryMutedUntil = Date.now() + 15 * 60 * 1000;
        }
      }).catch(() => {
        // Silently ignore telemetry network failures
      });
    } catch (err) {
      // Telemetry should never throw or break caller
    }
  }

  // Fetch recent logs from Firestore for the Live Log Viewer
  async function fetchRemoteLogs(limit = 60) {
    try {
      const endpoint = `${BASE_URL}?key=${FIREBASE_API_KEY}&pageSize=${limit}`;
      const response = await fetch(endpoint);
      if (!response.ok) return [];
      const data = await response.json();
      if (!data.documents || !Array.isArray(data.documents)) return [];

      return data.documents.map(doc => {
        const f = doc.fields || {};
        return {
          id: doc.name.split('/').pop(),
          docName: doc.name,
          action: f.action?.stringValue || 'LOG',
          deviceId: f.deviceId?.stringValue || 'Desconocido',
          deviceLabel: f.deviceLabel?.stringValue || 'Dispositivo',
          os: f.os?.stringValue || '',
          browser: f.browser?.stringValue || '',
          mode: f.mode?.stringValue || '',
          username: f.username?.stringValue || 'INVITADO',
          level: f.level?.stringValue || 'info',
          message: f.message?.stringValue || '',
          details: f.details?.stringValue || '',
          timestamp: f.timestamp?.timestampValue || doc.createTime || '',
          createTime: doc.createTime
        };
      }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (e) {
      console.warn('[Telemetry] Error al obtener logs remotos:', e);
      return [];
    }
  }

  // Delete a single log document
  async function deleteRemoteLog(docName) {
    try {
      const endpoint = `https://firestore.googleapis.com/v1/${docName}?key=${FIREBASE_API_KEY}`;
      const resp = await fetch(endpoint, { method: 'DELETE' });
      return resp.ok;
    } catch (e) {
      return false;
    }
  }

  // Global uncaught error listener
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('error', (event) => {
      sendRemoteLog('error', `Error no capturado: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || ''
      }, 'UNCAUGHT_ERROR');
    });

    // Global unhandled promise rejection listener
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || 'Promesa rechazada sin manejar');
      sendRemoteLog('error', `Promesa rechazada: ${msg}`, {
        stack: reason?.stack || ''
      }, 'PROMISE_REJECTION');
    });
  }

  // Send session startup heartbeat
  setTimeout(() => {
    sendRemoteLog('info', `Sesión iniciada en ${device.label}`, {
      url: window.location?.href || '',
      referrer: document?.referrer || 'Directo'
    }, 'APP_OPENED');
  }, 1000);

  // Expose API
  const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  root.Telemetry = {
    track: (action, msg, details) => sendRemoteLog('action', msg, details, action),
    log: (msg, details) => sendRemoteLog('info', msg, details, 'LOG'),
    info: (msg, details) => sendRemoteLog('info', msg, details, 'INFO'),
    warn: (msg, details) => sendRemoteLog('warn', msg, details, 'WARN'),
    error: (msg, details) => sendRemoteLog('error', msg, details, 'ERROR'),
    success: (msg, details) => sendRemoteLog('success', msg, details, 'SUCCESS'),
    fetchLogs: fetchRemoteLogs,
    deleteLog: deleteRemoteLog,
    getDeviceInfo: () => device,
    getDeviceId: () => deviceId
  };

})(typeof window !== 'undefined' ? window : globalThis);

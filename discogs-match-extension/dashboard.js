/**
 * Vinyl Stock Manager • Dashboard Modular System
 * 
 * The application has been cleanly decomposed into domain modules located in /js/:
 *  - js/state.js       • Central state, currency mappings, string and condition formatters
 *  - js/elements.js    • Cached DOM element registry
 *  - js/network.js     • Tab proxy communication, rate-limit backoff, downloads
 *  - js/parser.js      • Marketplace HTML parser, release info, shipping rates
 *  - js/scanner.js     • Scanning engine, radar shader canvas, session storage
 *  - js/optimizer.js   • Multi-vendor smart combinations, logistics amortization
 *  - js/renderers.js   • Ranked seller directory, wantlist crate cards, stats dashboard
 *  - js/local.js       • Local Google Drive / Sheets catalog importer & matching
 *  - js/modals.js      • Export to CSV/TSV, user preferences modal, popover alignment
 *  - js/app.js         • Master controller, view router, mobile bar, event bindings
 */

console.log('[VinylManager] Architecture loaded successfully: 10 clean modules active.');

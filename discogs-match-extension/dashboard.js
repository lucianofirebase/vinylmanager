/**
 * Vinyl Stock Manager • Clean Layered Architecture System
 * 
 * Layer 1: Core & Reactive State
 *  - js/core/events.js           • Centralized event contract catalog (AppEvents)
 *  - js/core/store.js            • Reactive PubSub store (AppStore)
 *  - js/elements.js              • Cached DOM element registry
 *  - js/state.js                 • Global state and defaults
 * 
 * Layer 2: Infrastructure & Data Access
 *  - js/infrastructure/cache-repository.js • LocalStorage / SessionStorage with TTL
 *  - js/infrastructure/api-client.js      • Authenticated Discogs API with 429 retry
 *  - js/network.js               • Background proxy tab bridge
 * 
 * Layer 3: Pure Domain & Business Logic (0 DOM)
 *  - js/domain/currency-service.js  • Exchange rates, conversions, formatPrice
 *  - js/domain/filter-engine.js     • Filter predicates, Goldmine rank, sorting
 *  - js/domain/shipping-engine.js   • ASP banner parser, shipping tiers, weight rules
 *  - js/domain/discogs-parser.js    • Wantlist & Release HTML parser, seller grouping
 *  - js/domain/optimizer-service.js • Multi-vendor smart purchase candidates solver
 *  - js/domain/local-matcher.js     • Google Sheets / Excel fuzzy catalog matcher
 * 
 * Layer 4: Orchestration & Services
 *  - js/services/scan-coordinator.js • Scan lifecycle, queues, throttling, session save
 * 
 * Layer 5: UI Presentation Components
 *  - js/ui/router.js                 • View & Tab navigation (Wants, Sellers, Stats, Local)
 *  - js/ui/radar-renderer.js         • Canvas radar shader & vinyl animation
 *  - js/ui/smart-purchase-renderer.js• Bento grid luxury cards (Option A & B)
 *  - js/ui/wants-grid-renderer.js    • Wantlist crate grid, favorites (★), pagination
 *  - js/renderers.js                 • Seller ranking directory & stats dashboard
 *  - js/facade.js                    • Backward-compatible global window facade
 */

console.log('[VinylManager] Clean Layered Architecture loaded: 16 decoupled modules active.');


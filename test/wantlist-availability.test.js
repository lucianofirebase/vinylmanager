const { test, describe } = require('node:test');
const assert = require('node:assert');

// Mock browser global environment if needed
if (typeof window === 'undefined') {
  global.window = global;
}

// Load renderers or availability logic
const renderersModule = require('../discogs-match-extension/js/renderers.js');
const classifyWantlistAvailability = renderersModule.classifyWantlistAvailability || global.classifyWantlistAvailability;

describe('Wantlist Availability & Destination Shipping Verification', () => {

  test('1. Discos disponibles para el destino del usuario (con ofertas directas)', () => {
    const wants = [
      { id: 101, title: 'Kind of Blue', artist: 'Miles Davis', wantCount: 500 },
      { id: 102, title: 'A Love Supreme', artist: 'John Coltrane', wantCount: 400 }
    ];

    const listings = [
      { releaseId: 101, priceVal: 25.0, sellerName: 'JazzShop' },
      { releaseId: 102, priceVal: 30.0, sellerName: 'VinylHeaven' }
    ];

    const result = classifyWantlistAvailability(wants, listings, 'Uruguay');

    assert.strictEqual(result.totalWantsCount, 2);
    assert.strictEqual(result.wantsForSale.length, 2);
    assert.strictEqual(result.wantsNotForSale.length, 0);
    assert.strictEqual(result.wantsBlockedByShipping.length, 0);
    assert.strictEqual(result.wantsTrulyUnavailable.length, 0);
    assert.strictEqual(result.buyerCountryVal, 'Uruguay');
  });

  test('2. Discos bloqueados por envío: existen copias pero no envían al país de destino', () => {
    const wants = [
      {
        id: 201,
        title: 'Random Access Memories',
        artist: 'Daft Punk',
        totalWorldListings: 12,
        unshippableCount: 12,
        unshippableLocations: ['Germany', 'United Kingdom'],
        isBlockedByShipping: true,
        wantCount: 800
      },
      {
        id: 202,
        title: 'Selected Ambient Works',
        artist: 'Aphex Twin',
        hasShippingBlockNotice: true,
        totalWorldListings: 5,
        wantCount: 600
      }
    ];

    // 0 listings that ship to Uruguay
    const listings = [];

    const result = classifyWantlistAvailability(wants, listings, 'Uruguay');

    assert.strictEqual(result.wantsForSale.length, 0);
    assert.strictEqual(result.wantsNotForSale.length, 2);
    assert.strictEqual(result.wantsBlockedByShipping.length, 2);
    assert.strictEqual(result.wantsTrulyUnavailable.length, 0);

    // Verify world counts
    assert.strictEqual(result.getWorldCount(wants[0]), 12);
    assert.strictEqual(result.getWorldCount(wants[1]), 5);
  });

  test('3. Discos agotados mundialmente: 0 copias en todo Discogs', () => {
    const wants = [
      {
        id: 301,
        title: 'Rare Private Pressing',
        artist: 'Unknown Artist',
        totalWorldListings: 0,
        unshippableCount: 0,
        isBlockedByShipping: false,
        hasShippingBlockNotice: false,
        forSaleCount: 0,
        wantCount: 50
      },
      {
        id: 302,
        title: 'Demo Cassette Rip',
        artist: 'Obscure Band',
        totalWorldListings: 0,
        unshippableCount: 0,
        isBlockedByShipping: false,
        forSaleCount: 1, // Stale count from old cache, but totalWorldListings === 0 from live scan
        wantCount: 20
      }
    ];

    const listings = [];

    const result = classifyWantlistAvailability(wants, listings, 'Uruguay');

    assert.strictEqual(result.wantsForSale.length, 0);
    assert.strictEqual(result.wantsNotForSale.length, 2);
    assert.strictEqual(result.wantsBlockedByShipping.length, 0);
    assert.strictEqual(result.wantsTrulyUnavailable.length, 2, 'Los discos con 0 copias mundiales deben ir a Truly Unavailable');

    assert.strictEqual(result.getWorldCount(wants[0]), 0);
    assert.strictEqual(result.getWorldCount(wants[1]), 0, 'Incluso con forSaleCount viejo, si totalWorldListings es 0 el count debe ser 0');
  });

  test('4. Partición exacta y suma coherente de categorías', () => {
    const wants = [
      { id: 401, title: 'Item 1' }, // For sale
      { id: 402, title: 'Item 2', totalWorldListings: 4, unshippableCount: 4, isBlockedByShipping: true }, // Blocked
      { id: 403, title: 'Item 3', totalWorldListings: 0, unshippableCount: 0, isBlockedByShipping: false }, // Zero copies
      { id: 404, title: 'Item 4', totalWorldListings: 1, hasShippingBlockNotice: true } // Blocked
    ];

    const listings = [
      { releaseId: 401, priceVal: 15.0 }
    ];

    const result = classifyWantlistAvailability(wants, listings, 'Spain');

    assert.strictEqual(result.totalWantsCount, 4);
    assert.strictEqual(result.wantsForSale.length, 1);
    assert.strictEqual(result.wantsNotForSale.length, 3);
    assert.strictEqual(result.wantsBlockedByShipping.length, 2);
    assert.strictEqual(result.wantsTrulyUnavailable.length, 1);

    // Sum check
    assert.strictEqual(
      result.wantsForSale.length + result.wantsBlockedByShipping.length + result.wantsTrulyUnavailable.length,
      result.totalWantsCount
    );
  });

  test('5. Cambio dinámico de país de destino', () => {
    const wants = [
      { id: 501, title: 'EU Exclusive', totalWorldListings: 3, unshippableCount: 3, isBlockedByShipping: true }
    ];

    const resUruguay = classifyWantlistAvailability(wants, [], 'Uruguay');
    assert.strictEqual(resUruguay.buyerCountryVal, 'Uruguay');
    assert.strictEqual(resUruguay.wantsBlockedByShipping.length, 1);

    // If buyer is in Spain and seller ships to Spain
    const listingsInSpain = [{ releaseId: 501, priceVal: 20.0, sellerName: 'MadridVinyl' }];
    const resSpain = classifyWantlistAvailability(wants, listingsInSpain, 'Spain');
    assert.strictEqual(resSpain.buyerCountryVal, 'Spain');
    assert.strictEqual(resSpain.wantsForSale.length, 1);
    assert.strictEqual(resSpain.wantsNotForSale.length, 0);
  });

  test('6. Release con copias en Discogs pero sin envíos a Uruguay (caso Star Sounds Orchestra)', () => {
    const wants = [
      {
        id: 219115,
        title: 'Trommler',
        artist: 'Star Sounds Orchestra',
        forSaleCount: 2,
        totalWorldListings: 2,
        unshippableCount: 2,
        isBlockedByShipping: true,
        hasShippingBlockNotice: true,
        wantCount: 250
      }
    ];

    const listings = []; // 0 listings ship to Uruguay

    const result = classifyWantlistAvailability(wants, listings, 'Uruguay');

    assert.strictEqual(result.totalWantsCount, 1);
    assert.strictEqual(result.wantsForSale.length, 0);
    assert.strictEqual(result.wantsNotForSale.length, 1);
    assert.strictEqual(result.wantsBlockedByShipping.length, 1, 'Debe ir a bloqueados por envío (no a agotados mundialmente)');
    assert.strictEqual(result.wantsTrulyUnavailable.length, 0, 'No debe considerarse agotado mundialmente');
    assert.strictEqual(result.getWorldCount(wants[0]), 2);
  });
});

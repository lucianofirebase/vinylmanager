const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { DiscogsShippingService } = require('../discogs-match-extension/js/infrastructure/discogs-shipping.js');

// Real Discogs API Mock Fixtures
const haveABreakFixture = {
  seller_uid: 1547313,
  currency: 'EUR',
  policies: [
    {
      id: 9460299,
      countries: ['Germany'],
      free_shipping: true,
      free_shipping_min_order_val: 50.0,
      formatted_free_shipping_min_order_val: '€50.00',
      methods: [{ name: 'DHL Standard', price: 4.5, currency: 'EUR' }]
    },
    {
      id: 9460300,
      countries: ['Argentina', 'Uruguay', 'Brazil', 'Chile'],
      free_shipping: true,
      free_shipping_min_order_val: 350.0,
      formatted_free_shipping_min_order_val: '€350.00',
      free_shipping_description: 'Have-A-Break offers free shipping on orders €350.00 EUR or more',
      methods: [
        {
          name: 'Tracked Airmail',
          price: 28.5,
          currency: 'EUR',
          min_weight: 0,
          max_weight: 1000,
          delivery_min: 7,
          delivery_max: 21
        },
        {
          name: 'Free Shipping',
          price: 0,
          currency: 'EUR',
          min_weight: 0,
          max_weight: 5000
        }
      ]
    }
  ]
};

const sellerNoFreeShippingFixture = {
  seller_uid: 888123,
  currency: 'USD',
  policies: [
    {
      id: 111222,
      countries: ['Uruguay', 'United States'],
      free_shipping: false,
      free_shipping_min_order_val: null,
      methods: [{ name: 'USPS International', price: 25.0, currency: 'USD' }]
    }
  ]
};

const sellerOnlyDomesticFixture = {
  seller_uid: 999444,
  currency: 'GBP',
  policies: [
    {
      id: 333444,
      countries: ['United Kingdom'],
      free_shipping: true,
      free_shipping_min_order_val: 40.0,
      methods: [{ name: 'Royal Mail 1st Class', price: 3.5, currency: 'GBP' }]
    }
  ]
};

describe('DiscogsShippingService Unit Tests', () => {
  let service;

  beforeEach(() => {
    service = new DiscogsShippingService({
      ttlMs: 60000 // 1 minute for test
    });
  });

  // Test 1: Seller que envía al país y ofrece free shipping
  test('1. Seller que envía al país y ofrece free shipping', async () => {
    service.fetchFn = async () => haveABreakFixture;

    const result = await service.getSellerShippingPolicy(1547313, 'Uruguay');

    assert.strictEqual(result.sellerId, 1547313);
    assert.strictEqual(result.country, 'Uruguay');
    assert.strictEqual(result.shipsToCountry, true);
    assert.strictEqual(result.freeShipping, true);
    assert.strictEqual(result.freeShippingMinimum, 350.0);
    assert.strictEqual(result.currency, 'EUR');
    assert.strictEqual(result.formattedFreeShippingMinimum, '€350.00');
    assert.strictEqual(result.methods.length, 2);
    assert.strictEqual(result.status, 'success');
  });

  // Test 2: Seller que envía al país pero NO ofrece free shipping
  test('2. Seller que envía al país pero NO ofrece free shipping', async () => {
    service.fetchFn = async () => sellerNoFreeShippingFixture;

    const result = await service.getSellerShippingPolicy(888123, 'Uruguay');

    assert.strictEqual(result.sellerId, 888123);
    assert.strictEqual(result.country, 'Uruguay');
    assert.strictEqual(result.shipsToCountry, true);
    assert.strictEqual(result.freeShipping, false);
    assert.strictEqual(result.freeShippingMinimum, null);
    assert.strictEqual(result.methods.length, 1);
    assert.strictEqual(result.status, 'success');
  });

  // Test 3: Seller que no tiene policy para el país
  test('3. Seller que no tiene policy para el país', async () => {
    service.fetchFn = async () => sellerOnlyDomesticFixture;

    const result = await service.getSellerShippingPolicy(999444, 'Uruguay');

    assert.strictEqual(result.sellerId, 999444);
    assert.strictEqual(result.country, 'Uruguay');
    assert.strictEqual(result.shipsToCountry, false);
    assert.strictEqual(result.freeShipping, false);
    assert.strictEqual(result.freeShippingMinimum, null);
    assert.strictEqual(result.methods.length, 0);
    assert.strictEqual(result.status, 'not_shippable');
  });

  // Test 4: Cambio de país (mismo seller, diferente país)
  test('4. Cambio de país (mismo seller, diferente país)', async () => {
    let requestedCountry = '';
    service.fetchFn = async (url) => {
      const u = new URL(url);
      requestedCountry = u.searchParams.get('country');
      return haveABreakFixture;
    };

    const uruguayResult = await service.getSellerShippingPolicy(1547313, 'Uruguay');
    assert.strictEqual(uruguayResult.country, 'Uruguay');
    assert.strictEqual(uruguayResult.freeShippingMinimum, 350.0);
    assert.strictEqual(requestedCountry, 'Uruguay');

    const germanyResult = await service.getSellerShippingPolicy(1547313, 'Germany');
    assert.strictEqual(germanyResult.country, 'Germany');
    assert.strictEqual(germanyResult.freeShippingMinimum, 50.0);
    assert.strictEqual(requestedCountry, 'Germany');
  });

  // Test 5: Cache seller + country
  test('5. Cache seller + country evita llamadas de red repetidas', async () => {
    let callCount = 0;
    service.fetchFn = async () => {
      callCount++;
      return haveABreakFixture;
    };

    const res1 = await service.getSellerShippingPolicy(1547313, 'Uruguay');
    const res2 = await service.getSellerShippingPolicy(1547313, 'Uruguay');

    assert.strictEqual(callCount, 1, 'Debe llamar al endpoint exactamente 1 vez para el mismo seller y país');
    assert.deepStrictEqual(res1, res2);
  });

  // Test 6: Error HTTP (404, 500, network error)
  test('6. Error HTTP no rompe la aplicación y devuelve status error', async () => {
    service.fetchFn = async () => {
      const err = new Error('HTTP Error 500 Internal Server Error');
      err.status = 500;
      throw err;
    };

    const result = await service.getSellerShippingPolicy(777, 'Uruguay');

    assert.strictEqual(result.sellerId, 777);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(result.shipsToCountry, false);
    assert.strictEqual(result.freeShipping, false);
    assert.strictEqual(result.freeShippingMinimum, null);
    assert.ok(result.error);
  });

  // Test 7: Respuesta con múltiples policies (debe seleccionar la correspondiente)
  test('7. Respuesta con múltiples policies determina la correcta por país', () => {
    const norm = service.normalizeResponse(haveABreakFixture, 1547313, 'Germany');
    assert.strictEqual(norm.shipsToCountry, true);
    assert.strictEqual(norm.freeShippingMinimum, 50.0);

    const normUy = service.normalizeResponse(haveABreakFixture, 1547313, 'Uruguay');
    assert.strictEqual(normUy.shipsToCountry, true);
    assert.strictEqual(normUy.freeShippingMinimum, 350.0);

    const normJapan = service.normalizeResponse(haveABreakFixture, 1547313, 'Japan');
    assert.strictEqual(normJapan.shipsToCountry, false);
  });

  // Test 8: free_shipping = false
  test('8. free_shipping = false produce freeShipping: false', () => {
    const fixture = {
      seller_uid: 555,
      currency: 'USD',
      policies: [
        {
          id: 1,
          countries: ['Uruguay'],
          free_shipping: false,
          free_shipping_min_order_val: 100, // aunque tenga valor, free_shipping es false
          methods: []
        }
      ]
    };
    const norm = service.normalizeResponse(fixture, 555, 'Uruguay');
    assert.strictEqual(norm.freeShipping, false);
    assert.strictEqual(norm.freeShippingMinimum, null);
  });

  // Test 9: free_shipping_min_order_val = null o inexistente
  test('9. free_shipping_min_order_val = null o inexistente', () => {
    const fixture = {
      seller_uid: 556,
      currency: 'EUR',
      policies: [
        {
          id: 1,
          countries: ['Uruguay'],
          free_shipping: true,
          free_shipping_min_order_val: null,
          methods: []
        }
      ]
    };
    const norm = service.normalizeResponse(fixture, 556, 'Uruguay');
    assert.strictEqual(norm.freeShipping, false);
    assert.strictEqual(norm.freeShippingMinimum, null);
  });

  // Test 10: Dos sellers diferentes con el mismo país
  test('10. Dos sellers diferentes con el mismo país no colisionan en caché', async () => {
    let lastSellerQueried = null;
    service.fetchFn = async (url) => {
      const u = new URL(url);
      const sId = u.searchParams.get('seller_id');
      lastSellerQueried = sId;
      if (sId === '1001') {
        return {
          seller_uid: 1001,
          currency: 'USD',
          policies: [{ id: 1, countries: ['Uruguay'], free_shipping: true, free_shipping_min_order_val: 100 }]
        };
      } else {
        return {
          seller_uid: 1002,
          currency: 'EUR',
          policies: [{ id: 2, countries: ['Uruguay'], free_shipping: true, free_shipping_min_order_val: 200 }]
        };
      }
    };

    const s1 = await service.getSellerShippingPolicy(1001, 'Uruguay');
    const s2 = await service.getSellerShippingPolicy(1002, 'Uruguay');

    assert.strictEqual(s1.sellerId, 1001);
    assert.strictEqual(s1.freeShippingMinimum, 100);
    assert.strictEqual(s2.sellerId, 1002);
    assert.strictEqual(s2.freeShippingMinimum, 200);
  });

  // Test 11: Mismo seller con dos países diferentes
  test('11. Mismo seller con dos países diferentes no se contaminan', async () => {
    service.fetchFn = async () => haveABreakFixture;

    const resUy = await service.getSellerShippingPolicy(1547313, 'Uruguay');
    const resUk = await service.getSellerShippingPolicy(1547313, 'United Kingdom');

    assert.strictEqual(resUy.country, 'Uruguay');
    assert.strictEqual(resUy.shipsToCountry, true);
    assert.strictEqual(resUy.freeShipping, true);
    assert.strictEqual(resUy.freeShippingMinimum, 350.0);

    assert.strictEqual(resUk.country, 'United Kingdom');
    assert.strictEqual(resUk.shipsToCountry, false);
    assert.strictEqual(resUk.freeShipping, false);
    assert.strictEqual(resUk.freeShippingMinimum, null);
  });
});

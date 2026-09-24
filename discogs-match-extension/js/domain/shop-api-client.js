/**
 * Vinyl Stock Manager • Shop Page API Client (js/domain/shop-api-client.js)
 * High-speed native Discogs Shop API client for fetching wantlist marketplace offers
 * and seller inventory matches via same-origin tab proxy.
 */

class ShopApiClient {
  constructor() {
    this.BASE_URL = 'https://www.discogs.com/api/shop-page-api';
  }

  /**
   * Fetches marketplace listings for items matching the user's wantlist
   * @param {Object} options
   * @param {number} [options.count=25] - Number of items to fetch (e.g. 25, 50, 100)
   * @param {number} [options.offset=0] - Offset for pagination
   * @param {number} [options.sellerRatingMin=90] - Minimum seller rating percentage
   * @param {string} [options.sort='listedDate'] - Sort field (e.g. 'listedDate', 'price')
   * @param {string} [options.sortOrder='descending'] - Sort direction ('ascending' | 'descending')
   * @param {boolean} [options.facets=true] - Whether to include facet aggregations
   * @returns {Promise<{ items: Array, totalCount: number, facetCounts: Object, bucketCounts: Object }>}
   */
  async fetchShopItems({
    count = 25,
    offset = 0,
    sellerRatingMin = 90,
    sort = 'listedDate',
    sortOrder = 'descending',
    facets = true
  } = {}) {
    const params = new URLSearchParams({
      sellerRatingMin: String(sellerRatingMin),
      sort: sort,
      sortOrder: sortOrder,
      count: String(count),
      offset: String(offset),
      facets: facets ? 'true' : 'false'
    });

    const url = `${this.BASE_URL}/sell_item?${params.toString()}`;
    console.log(`[ShopApiClient] Fetching shop items: offset=${offset}, count=${count}...`);

    try {
      let rawText = '';
      if (typeof fetchThroughTab === 'function') {
        rawText = await fetchThroughTab(url);
      } else if (typeof fetchDirect === 'function') {
        rawText = await fetchDirect(url);
      } else {
        const resp = await fetch(url, { credentials: 'include' });
        rawText = await resp.text();
      }

      if (!rawText || typeof rawText !== 'string') {
        throw new Error('Respuesta vacía del endpoint Shop API');
      }

      const data = JSON.parse(rawText);
      console.log(`[ShopApiClient] Éxito: ${data.items ? data.items.length : 0} ítems recibidos (Total disponible: ${data.totalCount || 0}).`);
      return data;
    } catch (err) {
      console.error('[ShopApiClient] Error al consultar sell_item:', err);
      throw err;
    }
  }

  /**
   * Fetches seller inventory match counts for multiple seller IDs
   * @param {Array<number|string>} sellerIds - Array of Discogs seller UIDs
   * @returns {Promise<{ countsBySeller: Object }>}
   */
  async fetchMoreItems(sellerIds = []) {
    if (!sellerIds || sellerIds.length === 0) {
      return { countsBySeller: {} };
    }

    const query = sellerIds.map(id => `seller_id=${encodeURIComponent(id)}`).join('&');
    const url = `${this.BASE_URL}/more_items?${query}`;
    console.log(`[ShopApiClient] Consultando more_items para ${sellerIds.length} vendedores...`);

    try {
      let rawText = '';
      if (typeof fetchThroughTab === 'function') {
        rawText = await fetchThroughTab(url);
      } else if (typeof fetchDirect === 'function') {
        rawText = await fetchDirect(url);
      } else {
        const resp = await fetch(url, { credentials: 'include' });
        rawText = await resp.text();
      }

      const data = JSON.parse(rawText);
      console.log('[ShopApiClient] Éxito en more_items:', data);
      return data;
    } catch (err) {
      console.error('[ShopApiClient] Error al consultar more_items:', err);
      throw err;
    }
  }
}

// Global instance
const shopApiClient = new ShopApiClient();

/**
 * Diagnostic test function runnable directly from DevTools console:
 * await testShopApi()
 */
async function testShopApi(count = 5) {
  console.log(`%c[Test Agile Paso 1] Iniciando prueba de Shop API (${count} ítems)...`, 'color: #00ffcc; font-weight: bold;');
  try {
    const data = await shopApiClient.fetchShopItems({ count, offset: 0 });
    console.log('%c✓ Conexión exitosa con la API nativa de Discogs!', 'color: #00ff00; font-weight: bold;');
    console.log(`Total de ofertas activas para tu Wantlist: %c${data.totalCount}`, 'color: #ff0055; font-weight: bold;');
    
    if (data.items && data.items.length > 0) {
      console.log('Muestra de los primeros ítems obtenidos:');
      const summaryTable = data.items.map(it => ({
        Disco: `${it.release?.artists?.[0]?.name || ''} - ${it.release?.title || ''}`,
        Vendedor: it.seller?.name || '',
        País: it.seller?.shipsFrom || '',
        Precio: `${it.price?.amount || 0} ${it.price?.currencyCode || ''} (~$${it.price?.buyerItemPrice || 0} USD)`,
        Envío: `$${it.shipping?.buyerShippingPrice || 0} USD`,
        Estado: it.mediaCondition || ''
      }));
      console.table(summaryTable);

      const sellerUids = [...new Set(data.items.map(it => it.seller?.uid).filter(Boolean))];
      if (sellerUids.length > 0) {
        console.log(`Consultando coincidencias de inventario para vendedores (${sellerUids.slice(0, 5).join(', ')}...):`);
        const more = await shopApiClient.fetchMoreItems(sellerUids.slice(0, 5));
        console.log('Coincidencias por vendedor (countsBySeller):', more.countsBySeller);
      }
    }
    return data;
  } catch (e) {
    console.error('%c✗ Falló la prueba de Shop API:', 'color: #ff3333; font-weight: bold;', e.message);
    throw e;
  }
}

if (typeof window !== 'undefined') {
  window.ShopApiClient = ShopApiClient;
  window.shopApiClient = shopApiClient;
  window.testShopApi = testShopApi;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ShopApiClient, shopApiClient, testShopApi };
}

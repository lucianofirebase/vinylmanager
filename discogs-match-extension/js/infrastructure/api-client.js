/**
 * Discogs Matcher • API Client
 * Manages official Discogs API requests, client tokens, and proxy tab communication
 */

class DiscogsApiClient {
  constructor() {
    this.DEFAULT_CLIENT_TOKEN = 'Client token=WzExMTcwNjY2XQ.arLr3Q.Q8GKVcjOuc6yrt_JCbh9vns3CGA';
    this.BASE_API_URL = 'https://api.discogs.com';
  }

  getAuthHeader() {
    try {
      const custom = localStorage.getItem('discogs_client_token');
      if (custom && custom.trim()) {
        const val = custom.trim();
        return (val.startsWith('Client token=') || val.startsWith('Discogs token=') || val.startsWith('Bearer '))
          ? val
          : `Client token=${val}`;
      }
    } catch (e) {}
    return this.DEFAULT_CLIENT_TOKEN;
  }

  async fetchDirect(url, customHeaders = {}) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Authorization': this.getAuthHeader(),
      ...customHeaders
    };

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const resp = await fetch(url, {
          method: 'GET',
          headers,
          credentials: 'include'
        });

        if (resp.status === 429) {
          const waitTime = Math.pow(2, attempts) * 1500;
          console.warn(`[ApiClient] Rate limit 429 on ${url}. Retrying in ${waitTime}ms (attempt ${attempts}/${maxAttempts})...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        }

        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await resp.json();
        }
        return await resp.text();
      } catch (err) {
        if (attempts >= maxAttempts) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempts));
      }
    }
  }

  async getShippingPolicies(sellerId, country = 'Uruguay') {
    const url = `${this.BASE_API_URL}/v3/marketplace/shipping/policies?seller_id=${sellerId}&country=${encodeURIComponent(country)}`;
    return await this.fetchDirect(url);
  }
}

const discogsApiClient = new DiscogsApiClient();

if (typeof window !== 'undefined') {
  window.DiscogsApiClient = DiscogsApiClient;
  window.discogsApiClient = discogsApiClient;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DiscogsApiClient, discogsApiClient };
}

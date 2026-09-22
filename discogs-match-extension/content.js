// Content script to act as a same-origin fetch proxy within a Discogs tab
console.log("[Discogs Matcher] Content script proxy ready on Discogs domain.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchUrl") {
    console.log("[Discogs Matcher] Proxy fetching same-origin URL:", request.url);

    // Perform fetch with credentials inside discogs.com page context (inherits active cookies like __cf_bm & session)
    const headers = {
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7'
    };

    if (request.headers && typeof request.headers === 'object') {
      Object.assign(headers, request.headers);
    }

    if (request.url && request.url.includes('api.discogs.com') && !headers['Authorization']) {
      try {
        let token = localStorage.getItem('discogs_client_token') ||
                    localStorage.getItem('token') ||
                    localStorage.getItem('discogs_user_token');
        if (token) {
          headers['Authorization'] = (token.startsWith('Client token=') || token.startsWith('Bearer ') || token.startsWith('Discogs token='))
            ? token
            : `Client token=${token}`;
        } else {
          headers['Authorization'] = 'Client token=WzExMTcwNjY2XQ.arLr3Q.Q8GKVcjOuc6yrt_JCbh9vns3CGA';
        }
      } catch (e) {
        headers['Authorization'] = 'Client token=WzExMTcwNjY2XQ.arLr3Q.Q8GKVcjOuc6yrt_JCbh9vns3CGA';
      }
    }

    fetch(request.url, {
      method: 'GET',
      credentials: 'include',
      headers: headers
    })
    .then(async response => {
      // Check HTTP Status
      if (response.status === 429) {
        return sendResponse({
          success: false,
          error: "HTTP Error 429: Too Many Requests",
          status: 429,
          isRateLimited: true
        });
      }

      if (response.status === 401 || response.status === 403) {
        return sendResponse({
          success: false,
          error: `HTTP Error ${response.status}: Unauthorized / Session Expired`,
          status: response.status,
          isSessionExpired: true
        });
      }

      if (!response.ok) {
        return sendResponse({
          success: false,
          error: `HTTP Error ${response.status}: ${response.statusText}`,
          status: response.status
        });
      }

      // Check if redirected to login page
      const redirectedToLogin = response.url && (response.url.includes('/login') || response.url.includes('/users/login'));
      const html = await response.text();

      if (redirectedToLogin || (html.includes('id="login-form"') && !request.url.includes('/login'))) {
        return sendResponse({
          success: false,
          error: "Session expired or Discogs login required",
          status: 401,
          isSessionExpired: true
        });
      }

      sendResponse({ success: true, html, status: response.status });
    })
    .catch(error => {
      console.error("[Discogs Matcher] Same-origin fetch network error:", error);
      sendResponse({
        success: false,
        error: error.message || "Network error in proxy tab",
        isNetworkError: true
      });
    });

    return true; // Keep message channel open for async response
  }
});

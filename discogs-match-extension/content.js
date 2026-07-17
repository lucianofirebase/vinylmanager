// Content script to act as a same-origin fetch proxy within a Discogs tab
console.log("[Discogs Wishlist Matcher] Content script loaded on Discogs domain.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchUrl") {
    console.log("[Discogs Wishlist Matcher] Fetching URL same-origin:", request.url);
    
    // Perform standard fetch request inside the discogs.com page context
    // This inherits the user's active session, cookies, and bypasses Cloudflare checks.
    fetch(request.url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
      }
      return response.text();
    })
    .then(html => {
      sendResponse({ success: true, html });
    })
    .catch(error => {
      console.error("[Discogs Wishlist Matcher] Same-origin fetch failed:", error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keeps the message channel open for the async response
  }
});

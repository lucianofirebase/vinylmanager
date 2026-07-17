document.getElementById('open-dashboard-btn').addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html')
    });
  } else {
    // Fallback for debugging in standard browser pages
    window.open('dashboard.html', '_blank');
  }
});

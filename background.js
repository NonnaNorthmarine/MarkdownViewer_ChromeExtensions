chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    chrome.extension.isAllowedFileSchemeAccess((isAllowed) => {
      if (!isAllowed) {
        chrome.tabs.create({ url: chrome.runtime.getURL("guide.html") });
      }
    });
  }
});

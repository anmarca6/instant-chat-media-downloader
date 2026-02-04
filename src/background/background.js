/**
 * Background Service Worker - Instant Chat Media Downloader
 * Handles file downloads and analytics
 */

const INSTANTDB_APP_ID = 'cb803448-2738-4c21-a6ae-693bc1494703';
const INSTANTDB_ADMIN_TOKEN = 'ffae9675-d097-437a-8a44-5565c42e898f';

// Store pending download intercept information
let pendingIntercept = null;
const INTERCEPT_TIMEOUT = 10000; // 10 seconds

// Escuchar mensajes del content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    downloadFile(message.url, message.filename)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Mantener el canal abierto para respuesta asíncrona
  }
  
  if (message.action === 'prepareDownloadIntercept') {
    pendingIntercept = {
      filename: message.filename,
      conversationName: message.conversationName,
      timestamp: Date.now()
    };

    // Clear intercept after timeout
    setTimeout(() => {
      if (pendingIntercept && Date.now() - pendingIntercept.timestamp > INTERCEPT_TIMEOUT) {
        pendingIntercept = null;
      }
    }, INTERCEPT_TIMEOUT);

    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'sendAnalytics') {
    sendAnalyticsEvent(message.event, message.total_items, message.timestamp)
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }
});

/**
 * Generate a UUID v4
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Send analytics event to InstantDB via REST API
 * @param {string} eventName - Event name (magic_scan or full_scan)
 * @param {number} totalItems - Number of items found
 * @param {number} timestamp - Unix timestamp in seconds
 */
async function sendAnalyticsEvent(eventName, totalItems, timestamp) {
  try {
    const response = await fetch('https://api.instantdb.com/admin/transact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INSTANTDB_ADMIN_TOKEN}`,
        'App-Id': INSTANTDB_APP_ID
      },
      body: JSON.stringify({
        steps: [
          ['update', 'events', generateId(), {
            event: eventName,
            total_items: totalItems,
            timestamp: timestamp,
            createdAt: Date.now(),
            datetime: new Date().toISOString()
          }]
        ]
      })
    });
    return response.ok;
  } catch (error) {
    return null;
  }
}

/**
 * Descarga un archivo usando la API de Chrome
 */
async function downloadFile(url, filename) {
  try {
    
    // Chrome should automatically create folders in the path
    // The filename should be relative to Downloads folder: whatsapp/folder_name/file.ext
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename, // Relative path: Chrome will create folders automatically
      saveAs: false // Don't ask user, download directly
    });
    
    
    // Esperar a que termine la descarga
    return new Promise((resolve, reject) => {
      const listener = (delta) => {
        if (delta.id === downloadId && delta.state) {
          if (delta.state.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            resolve(downloadId);
          } else if (delta.state.current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error('Download interrupted'));
          }
        }
      };
      
      chrome.downloads.onChanged.addListener(listener);
      
      // 30 second timeout
      setTimeout(() => {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error('Download timeout'));
      }, 30000);
    });
    
  } catch (error) {
    throw error;
  }
}

// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    
    // Open welcome page
    chrome.tabs.create({
      url: 'https://web.whatsapp.com'
    });
  } else if (details.reason === 'update') {
  }
});

// Monitor download errors
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.error) {
  }
});

// Intercept downloads when pendingIntercept is set
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (pendingIntercept && Date.now() - pendingIntercept.timestamp < INTERCEPT_TIMEOUT) {
    
    // Cancel the original download first
    chrome.downloads.cancel(downloadItem.id, () => {
      
      // Wait a moment, then start new download with our folder structure
      setTimeout(() => {
        chrome.downloads.download({
          url: downloadItem.url,
          filename: pendingIntercept.filename,
          saveAs: false
        }, (newDownloadId) => {
          if (chrome.runtime.lastError) {
          } else {
          }
          // Clear intercept after use
          pendingIntercept = null;
        });
      }, 100);
    });
  }
});


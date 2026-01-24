/**
 * Popup Script - Instant Chat Media Downloader
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Instant Chat Media Downloader] Popup loaded');
  
  // Check if we're on WhatsApp Web
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('web.whatsapp.com')) {
      console.log('[Instant Chat Media Downloader] User on WhatsApp Web');
    }
  });
});


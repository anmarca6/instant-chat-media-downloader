// PDFLib Loader - Runs in page context
// This file loads pdf-lib and exposes it to the extension via window.__PDFLibForExtension
// The pdf-lib URL is passed via data-pdflib-url attribute on this script tag

(function() {
  // Get the script tag that loaded this file
  // Try multiple methods to find the script tag
  let currentScript = document.currentScript;
  if (!currentScript) {
    // Fallback: find script by src or data attribute
    const scripts = document.querySelectorAll('script[data-pdflib-url], script[src*="pdf-lib-loader"]');
    currentScript = scripts[scripts.length - 1]; // Get the last one (most recent)
  }
  
  const pdfLibUrl = currentScript ? currentScript.getAttribute('data-pdflib-url') : null;
  
  if (!pdfLibUrl) {
    console.error('[PDFLib Loader] PDFLib URL not found. Script tag:', currentScript);
    window.dispatchEvent(new CustomEvent('PDFLibError', { detail: { error: 'PDFLib URL not provided' } }));
    return;
  }
  
  console.log('[PDFLib Loader] Loading PDFLib from:', pdfLibUrl);
  
  // Force execution context by wrapping in IIFE with window as this
  const script = document.createElement('script');
  script.src = pdfLibUrl;
  script.type = 'text/javascript';
  
  script.onload = function() {
    console.log('[PDFLib Loader] PDFLib script loaded, waiting for initialization...');
    console.log('[PDFLib Loader] Checking for PDFLib in various locations...');
    
    // Wait for PDFLib to initialize and check multiple possible locations
    // Increased timeout to 10 seconds (100 attempts * 100ms)
    let attempts = 0;
    const maxAttempts = 100;
    const checkInit = setInterval(function() {
      attempts++;
      
      // Check multiple possible locations where PDFLib might be
      let foundPDFLib = null;
      
      // Check window.PDFLib first (most common)
      if (typeof window.PDFLib !== 'undefined') {
        if (window.PDFLib.PDFDocument) {
          foundPDFLib = window.PDFLib;
          console.log('[PDFLib Loader] Found PDFLib at window.PDFLib');
        } else {
          console.log('[PDFLib Loader] window.PDFLib exists but PDFDocument not ready yet');
        }
      }
      // Check global PDFLib variable
      else if (typeof PDFLib !== 'undefined') {
        if (PDFLib.PDFDocument) {
          foundPDFLib = PDFLib;
          console.log('[PDFLib Loader] Found PDFLib as global variable');
          // Also assign to window for content script access
          window.PDFLib = PDFLib;
        } else {
          console.log('[PDFLib Loader] PDFLib exists but PDFDocument not ready yet');
        }
      }
      // Check self.PDFLib
      else if (typeof self !== 'undefined' && typeof self.PDFLib !== 'undefined') {
        if (self.PDFLib.PDFDocument) {
          foundPDFLib = self.PDFLib;
          console.log('[PDFLib Loader] Found PDFLib at self.PDFLib');
          window.PDFLib = self.PDFLib;
        }
      }
      
      // Log progress every 10 attempts
      if (attempts % 10 === 0) {
        console.log(`[PDFLib Loader] Still waiting... (attempt ${attempts}/${maxAttempts})`);
      }
      
      if (foundPDFLib) {
        console.log('[PDFLib Loader] PDFLib initialized successfully');
        // Expose PDFLib on window so content script can access it
        window.__PDFLibForExtension = foundPDFLib;
        // Also dispatch custom event
        window.dispatchEvent(new CustomEvent('PDFLibReady', { detail: { PDFLib: foundPDFLib } }));
        clearInterval(checkInit);
      } else if (attempts >= maxAttempts) {
        console.error('[PDFLib Loader] PDFLib initialization timeout after', maxAttempts, 'attempts');
        console.error('[PDFLib Loader] Debug info:', {
          windowPDFLib: typeof window.PDFLib,
          windowPDFLibKeys: window.PDFLib ? Object.keys(window.PDFLib).slice(0, 20) : 'none',
          globalPDFLib: typeof PDFLib,
          selfPDFLib: typeof self !== 'undefined' ? typeof self.PDFLib : 'self undefined',
          windowKeysWithPDF: Object.keys(window).filter(k => k.toLowerCase().includes('pdf')).slice(0, 10),
          allWindowKeys: Object.keys(window).slice(0, 30) // First 30 keys for debugging
        });
        clearInterval(checkInit);
        window.dispatchEvent(new CustomEvent('PDFLibError', { detail: { error: 'Timeout - PDFLib not found after ' + maxAttempts + ' attempts' } }));
      }
    }, 100);
  };
  
  script.onerror = function(error) {
    console.error('[PDFLib Loader] Failed to load PDFLib script:', error);
    window.dispatchEvent(new CustomEvent('PDFLibError', { detail: { error: 'Script load failed' } }));
  };
  
  (document.head || document.documentElement).appendChild(script);
})();


// jsPDF Loader - Runs in page context
// This file loads jsPDF and exposes it to the extension via window.__jsPDFForExtension
// The jsPDF URL is passed via data-jspdf-url attribute on this script tag

(function() {
  // Get the script tag that loaded this file
  let currentScript = document.currentScript;
  if (!currentScript) {
    // Fallback: find script by src or data attribute
    const scripts = document.querySelectorAll('script[data-jspdf-url], script[src*="jspdf-loader"]');
    currentScript = scripts[scripts.length - 1]; // Get the last one (most recent)
  }
  
  const jsPDFUrl = currentScript ? currentScript.getAttribute('data-jspdf-url') : null;
  
  if (!jsPDFUrl) {
    console.error('[jsPDF Loader] jsPDF URL not found. Script tag:', currentScript);
    window.dispatchEvent(new CustomEvent('jsPDFError', { detail: { error: 'jsPDF URL not provided' } }));
    return;
  }
  
  console.log('[jsPDF Loader] Loading jsPDF from:', jsPDFUrl);
  
  // Load jsPDF script in page context using script tag
  const script = document.createElement('script');
  script.src = jsPDFUrl;
  script.type = 'text/javascript';
  script.async = false; // Load synchronously to ensure proper execution order
  
  script.onload = function() {
    console.log('[jsPDF Loader] Script loaded, starting check...');
    checkForJsPDF();
  };
  
  script.onerror = function(error) {
    console.error('[jsPDF Loader] Failed to load jsPDF script:', error);
    console.error('[jsPDF Loader] Script src:', script.src);
    window.dispatchEvent(new CustomEvent('jsPDFError', { detail: { error: 'Script load failed' } }));
  };
  
  // Also listen for any errors that might occur during script execution
  const errorHandler = function(event) {
    if (event.filename && event.filename.includes('jspdf')) {
      console.error('[jsPDF Loader] Error in jsPDF script:', event.message, event.filename, event.lineno);
      window.removeEventListener('error', errorHandler, true);
    }
  };
  window.addEventListener('error', errorHandler, true);
  
  (document.head || document.documentElement).appendChild(script);
  
  function checkForJsPDF() {
    console.log('[jsPDF Loader] jsPDF script loaded, waiting for initialization...');
    console.log('[jsPDF Loader] Checking window.jsPDF immediately:', typeof window.jsPDF, window.jsPDF);
    console.log('[jsPDF Loader] Checking window.jspdf immediately:', typeof window.jspdf, window.jspdf);
    
    // Wait a bit for the script to fully execute
    setTimeout(function() {
      console.log('[jsPDF Loader] After 50ms, window.jsPDF:', typeof window.jsPDF, window.jsPDF);
      console.log('[jsPDF Loader] After 50ms, window.jspdf:', typeof window.jspdf, window.jspdf);
      if (window.jspdf && typeof window.jspdf === 'object') {
        console.log('[jsPDF Loader] window.jspdf keys:', Object.keys(window.jspdf).slice(0, 10));
      }
    }, 50);
    
    // Wait for jsPDF to initialize and check multiple possible locations
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds
    const checkInit = setInterval(function() {
      attempts++;
      
      // Check multiple possible locations where jsPDF might be
      let foundJsPDF = null;
      
      // Method 1: window.jsPDF (direct - older versions)
      if (typeof window.jsPDF !== 'undefined') {
        foundJsPDF = window.jsPDF;
        console.log('[jsPDF Loader] Found jsPDF at window.jsPDF');
      }
      // Method 2: window.jspdf.jsPDF (newer versions)
      else if (typeof window.jspdf !== 'undefined') {
        if (window.jspdf.jsPDF) {
          foundJsPDF = window.jspdf.jsPDF;
          console.log('[jsPDF Loader] Found jsPDF at window.jspdf.jsPDF');
        } else if (window.jspdf.default) {
          foundJsPDF = window.jspdf.default;
          console.log('[jsPDF Loader] Found jsPDF at window.jspdf.default');
        } else if (typeof window.jspdf === 'function') {
          foundJsPDF = window.jspdf;
          console.log('[jsPDF Loader] Found jsPDF at window.jspdf (function)');
        } else {
          // Log what's in jspdf for debugging
          console.log('[jsPDF Loader] window.jspdf exists but structure is:', {
            type: typeof window.jspdf,
            keys: typeof window.jspdf === 'object' ? Object.keys(window.jspdf).slice(0, 20) : 'not an object',
            hasJsPDF: window.jspdf && window.jspdf.jsPDF !== undefined,
            hasDefault: window.jspdf && window.jspdf.default !== undefined
          });
        }
      }
      // Method 3: window.jspdf (if it's the constructor directly)
      else if (typeof window.jspdf !== 'undefined') {
        if (typeof window.jspdf === 'function') {
          foundJsPDF = window.jspdf;
          console.log('[jsPDF Loader] Found jsPDF at window.jspdf (function)');
        } else if (window.jspdf.jsPDF) {
          foundJsPDF = window.jspdf.jsPDF;
          console.log('[jsPDF Loader] Found jsPDF at window.jspdf.jsPDF (nested)');
        }
      }
      // Method 4: self.jspdf.jsPDF
      else if (typeof self !== 'undefined' && typeof self.jspdf !== 'undefined') {
        if (self.jspdf.jsPDF) {
          foundJsPDF = self.jspdf.jsPDF;
          console.log('[jsPDF Loader] Found jsPDF at self.jspdf.jsPDF');
        } else if (typeof self.jspdf === 'function') {
          foundJsPDF = self.jspdf;
          console.log('[jsPDF Loader] Found jsPDF at self.jspdf (function)');
        }
      }
      // Method 5: self.jsPDF
      else if (typeof self !== 'undefined' && typeof self.jsPDF !== 'undefined') {
        foundJsPDF = self.jsPDF;
        console.log('[jsPDF Loader] Found jsPDF at self.jsPDF');
      }
      
      // Log progress every 10 attempts
      if (attempts % 10 === 0) {
        console.log(`[jsPDF Loader] Still waiting... (attempt ${attempts}/${maxAttempts})`);
        console.log('[jsPDF Loader] Debug:', {
          hasWindowJsPDF: typeof window.jsPDF,
          hasWindowJspdf: typeof window.jspdf,
          windowJsPDFType: typeof window.jsPDF,
          windowJspdfType: typeof window.jspdf,
          windowJsPDFValue: window.jsPDF ? 'exists' : 'undefined',
          windowJspdfValue: window.jspdf ? 'exists' : 'undefined'
        });
      }
      
      if (foundJsPDF) {
        console.log('[jsPDF Loader] jsPDF initialized successfully');
        // Expose jsPDF on window so content script can access it
        window.__jsPDFForExtension = foundJsPDF;
        // Also dispatch custom event
        window.dispatchEvent(new CustomEvent('jsPDFReady', { detail: { jsPDF: foundJsPDF } }));
        clearInterval(checkInit);
      } else if (attempts >= maxAttempts) {
        console.error('[jsPDF Loader] jsPDF initialization timeout after', maxAttempts, 'attempts');
        console.error('[jsPDF Loader] Debug info:', {
          windowJspdf: typeof window.jspdf,
          windowJsPDF: typeof window.jsPDF,
          windowJspdfKeys: window.jspdf ? Object.keys(window.jspdf).slice(0, 20) : 'none',
          windowKeysWithPDF: Object.keys(window).filter(k => k.toLowerCase().includes('pdf') || k.toLowerCase().includes('jspdf')).slice(0, 10)
        });
        clearInterval(checkInit);
        window.dispatchEvent(new CustomEvent('jsPDFError', { detail: { error: 'Timeout - jsPDF not found after ' + maxAttempts + ' attempts' } }));
      }
    }, 100);
  };
})();


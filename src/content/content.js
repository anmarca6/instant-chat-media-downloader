/**
 * Content Script - Instant Chat Media Downloader
 * This script is injected into WhatsApp Web and handles media detection and downloading
 */

class InstantChatMediaDownloader {
  constructor() {
    this.mediaItems = {
      images: new Set(),
      documents: new Set()
    };
    this.isScanning = false;

    this.documentButtons = new Map();
    this.isPaused = false;
    this.ui = null;
    this.observer = null;
    this.downloadQueue = [];
    this.isDownloading = false;
    this.downloadWarningShown = false;
    this.conversationName = null;
    this.autoScanDone = false;
    this.timeRangeHours = null;
    this.currentConversationId = null;
    this.conversationCheckInterval = null;
    this.analyticsConsent = null; // null = not asked, true = accepted, false = declined

    this.selectors = {
      chatContainer: '[data-testid="conversation-panel-body"]',
      messageList: '[role="application"]',
      imageMessage: 'img[src*="blob:"]',
      videoMessage: 'video[src*="blob:"]',
      audioMessage: 'audio[src*="blob:"]',
      documentMessage: '[data-testid="media-document"]',
      mediaViewer: '[data-testid="media-viewer"]',
      conversationHeader: 'header [data-testid="conversation-info-header"]',
      conversationTitle: 'header [data-testid="conversation-info-header"] span[dir="auto"]'
    };
  }

  startConversationMonitoring() {
    this.conversationCheckInterval = setInterval(() => {
      this.checkConversationChange();
    }, 2000);
  }

  stopConversationMonitoring() {
    if (this.conversationCheckInterval) {
      clearInterval(this.conversationCheckInterval);
      this.conversationCheckInterval = null;
    }
  }

  checkConversationChange() {
    try {
      const isPanelOpen = this.ui && this.ui.classList.contains('wmd-panel-open');
      if (!isPanelOpen) {
        return;
      }

      const currentName = this.getConversationName();
      const currentId = this.sanitizeConversationId(currentName);

      if (this.currentConversationId && currentId !== this.currentConversationId) {
        this.currentConversationId = currentId;
        this.conversationName = currentName;
        this.autoScanDone = false;
        this.downloadSessionFolder = null;

        this.mediaItems = {
          images: new Set(),
          documents: new Set()
        };
        this.documentButtons = new Map();

        this.isScanning = false;
    

        this.updateCounts();

        const status = document.getElementById('wmd-status');
        if (status) {
          status.textContent = 'Click "Magic Scan" to start';
          status.className = 'wmd-status';
        }

        this.setDownloadButtonsDisabled(true);

        const progress = document.getElementById('wmd-progress');
        if (progress) {
          progress.style.display = 'none';
        }



      } else if (!this.currentConversationId) {
        this.currentConversationId = currentId;
        this.conversationName = currentName;

        this.mediaItems = {
          images: new Set(),
          documents: new Set()
        };
        this.documentButtons = new Map();
        this.updateCounts();

        const status = document.getElementById('wmd-status');
        if (status) {
          status.textContent = 'Click "Magic Scan" to start';
          status.className = 'wmd-status';
        }

        this.setDownloadButtonsDisabled(true);

        const progress = document.getElementById('wmd-progress');
        if (progress) {
          progress.style.display = 'none';
        }


      }

    } catch (error) {
    }
  }

  cleanConversationName(text) {
    if (!text) return null;

    const statusPatterns = [
      /en línea/gi,
      /última vez.*/gi,
      /últ\. vez.*/gi,
      /hace \d+ (minuto|minutos|hora|horas|día|días)/gi,
      /escribiendo\.\.\./gi,
      /grabando audio\.\.\./gi,
      /haz clic aquí para ver la información de contacto/gi,
      /haz clic para.*/gi,
      /online/gi,
      /last seen.*/gi,
      /typing\.\.\./gi,
      /recording audio\.\.\./gi,
      /click here to.*/gi,
      /click to view.*/gi,
      /visto por último.*/gi,
      /digitando\.\.\./gi,
      /clique aqui para.*/gi,
      /hace/gi,
      /ago/gi,
      /at \d{1,2}:\d{2}/gi,
      /a las \d{1,2}:\d{2}/gi,
      /ayer/gi,
      /yesterday/gi,
      /today/gi,
      /hoy/gi
    ];

    let cleaned = text;

    for (const pattern of statusPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    if (cleaned.includes(' - ')) {
      cleaned = cleaned.split(' - ')[0].trim();
    }
    if (cleaned.includes(',')) {
      cleaned = cleaned.split(',')[0].trim();
    }

    return cleaned.trim();
  }

  getConversationName() {
    try {
      const headerText = document.querySelector('#main header')?.textContent || '';
      const allPageText = document.body?.textContent || '';

      const phonePatterns = [
        /\+\d{1,3}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}/,
        /\+\d{1,3}\s?\(?\d{1,4}\)?\s?\d{1,4}\s?\d{1,4}/,
        /\d{9,15}/,
        /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,
        /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/
      ];

      const searchTexts = [headerText, allPageText];
      for (const text of searchTexts) {
        for (const pattern of phonePatterns) {
          const match = text.match(pattern);
          if (match) {
            let phoneNumber = match[0].trim();
            phoneNumber = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
            if (phoneNumber.length >= 9) {
              return phoneNumber;
            }
          }
        }
      }

      const nameSelectors = [
        'header [data-testid="conversation-info-header"]',
        'header [data-testid="conversation-header"]',
        'header div[role="button"]',
        '#main header',
        'header.chat-header'
      ];

      for (const selector of nameSelectors) {
        const headerElement = document.querySelector(selector);
        if (headerElement) {
          const textElements = headerElement.querySelectorAll('span, div');
          for (const element of textElements) {
            let text = element.textContent?.trim();
            if (text &&
                text.length > 0 &&
                text.length < 100 &&
                !text.includes('WhatsApp') &&
                !text.includes('Search') &&
                !text.includes('Menu') &&
                !text.includes('haz clic') &&
                !text.includes('click here') &&
                !text.includes('clique aqui') &&
                !text.match(/^\d{1,2}:\d{2}$/)) {

              text = this.cleanConversationName(text);

              if (text && text.length > 0) {
                return text;
              }
            }
          }
        }
      }

      const mainHeader = document.querySelector('#main header');
      if (mainHeader) {
        const allText = mainHeader.textContent?.trim();
        if (allText) {
          const parts = allText.split(/\n|\t|  +/);
          for (const part of parts) {
            const cleaned = part.trim();
            if (cleaned.length > 0 && cleaned.length < 50) {
              return cleaned;
            }
          }
        }
      }

      const pageTitle = document.title;
      if (pageTitle && pageTitle !== 'WhatsApp' && !pageTitle.includes('WhatsApp Web')) {
        return pageTitle;
      }

      return null;

    } catch (error) {
      return null;
    }
  }

  sanitizeConversationId(name) {
    if (!name) {
      return 'unknown';
    }

    let sanitized = name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/\.+$/g, '')
      .replace(/^\.+/g, '')
      .replace(/_{2,}/g, '_')
      .replace(/[^\x00-\x7F]/g, '')
      .trim()
      .replace(/^_+|_+$/g, '');

    if (sanitized.length > 50) {
      sanitized = sanitized.substring(0, 50);
    }

    if (sanitized.length === 0) {
      sanitized = 'conversation';
    }

    return sanitized;
  }

  sanitizeFolderName(name) {
    if (!name) {
      const uniqueId = `conversation_${Date.now()}`;
      return uniqueId;
    }

    let sanitized = name
      .replace(/\+/g, 'plus_')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/\.+$/g, '')
      .replace(/^\.+/g, '')
      .replace(/_{2,}/g, '_')
      .replace(/[^\x00-\x7F]/g, '')
      .trim()
      .replace(/^_+|_+$/g, '');

    if (sanitized.length > 30) {
      sanitized = sanitized.substring(0, 30);
    }

    if (sanitized.length === 0) {
      sanitized = 'conversation';
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const folderName = `${year}${month}${day}_${hours}h${minutes}m${seconds}s`;

    return folderName;
  }

  async init() {
    try {
      // Load analytics consent from storage
      this.loadAnalyticsConsent();

      this.createUI();
      this.updateCounts();

      this.waitForWhatsAppLoad().then(() => {
        this.setupMutationObserver();
      }).catch(err => {
      });

    } catch (error) {
    }
  }

  loadAnalyticsConsent() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['analyticsConsent'], (result) => {
          if (result.analyticsConsent !== undefined) {
            this.analyticsConsent = result.analyticsConsent;
            this.updateAnalyticsToggleUI();
          }
        });
      }
    } catch (e) {
      // Silently fail
    }
  }

  saveAnalyticsConsent(consent) {
    this.analyticsConsent = consent;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ analyticsConsent: consent });
      }
    } catch (e) {
      // Silently fail
    }
    this.updateAnalyticsToggleUI();
  }

  updateAnalyticsToggleUI() {
    const toggle = document.getElementById('wmd-analytics-toggle');
    if (toggle) {
      toggle.checked = this.analyticsConsent === true;
    }
  }

  showAnalyticsConsentModal() {
    // Don't show if already answered
    if (this.analyticsConsent !== null) {
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'wmd-analytics-modal';
    modal.className = 'wmd-modal-overlay';
    modal.innerHTML = `
      <div class="wmd-modal">
        <div class="wmd-modal-header">
          <h3>📊 Help Improve This Extension</h3>
        </div>
        <div class="wmd-modal-body">
          <p>Would you like to share anonymous usage statistics to help us improve the extension?</p>
          <div class="wmd-modal-info">
            <p><strong>What we collect:</strong></p>
            <ul>
              <li>Number of scans performed</li>
              <li>Number of files found per scan</li>
              <li>Date of usage (aggregated daily)</li>
            </ul>
            <p><strong>What we DON'T collect:</strong></p>
            <ul>
              <li>No personal information</li>
              <li>No chat content or messages</li>
              <li>No file names or URLs</li>
              <li>No contact information</li>
            </ul>
          </div>
          <p class="wmd-modal-note">You can change this setting anytime from the panel.</p>
        </div>
        <div class="wmd-modal-actions">
          <button class="wmd-btn wmd-btn-secondary" id="wmd-analytics-decline">No, thanks</button>
          <button class="wmd-btn wmd-btn-primary" id="wmd-analytics-accept">Yes, I'll help</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('wmd-analytics-accept').addEventListener('click', () => {
      this.saveAnalyticsConsent(true);
      modal.remove();
    });

    document.getElementById('wmd-analytics-decline').addEventListener('click', () => {
      this.saveAnalyticsConsent(false);
      modal.remove();
    });
  }

  async waitForWhatsAppLoad() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 60;

      const checkInterval = setInterval(() => {
        attempts++;

        const chatContainer = document.querySelector(this.selectors.chatContainer);
        const alternativeContainer = document.querySelector('#main');

        if (chatContainer || alternativeContainer) {
          clearInterval(checkInterval);
          setTimeout(resolve, 1000);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  }

  createUI() {
    if (document.getElementById('whatsapp-media-downloader-panel')) {
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'whatsapp-media-downloader-panel';
    panel.className = 'wmd-panel';
    panel.innerHTML = `
      <div class="wmd-header">
        <div style="display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 0;">
          <h3>📥 Instant Chat Media Downloader</h3>
          <span style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 2px;">Version 1.9.3</span>
        </div>
        <button class="wmd-close" id="wmd-close-btn">×</button>
      </div>
      <a href="https://buymeacoffee.com/anmarca" target="_blank" rel="noopener noreferrer" class="wmd-coffee-link">
        ☕ Buy Me a Coffee
      </a>
      <div class="wmd-body">
        <div class="wmd-section wmd-summary" id="wmd-summary">
          <div class="wmd-summary-item">
            <span class="wmd-summary-icon">🖼️</span>
            <span class="wmd-summary-label">Images:</span>
            <span class="wmd-summary-count" id="wmd-count-images">0</span>
          </div>
          <div class="wmd-summary-item">
            <span class="wmd-summary-icon">📄</span>
            <span class="wmd-summary-label">Documents:</span>
            <span class="wmd-summary-count" id="wmd-count-documents">0</span>
          </div>
          <div class="wmd-summary-time">
            <span>📅 <span id="wmd-time-range-text">All messages</span></span>
          </div>
          <div class="wmd-summary-message" id="wmd-summary-message" style="display: none; margin-top: 12px; padding: 8px; background: #1e2a35; border-radius: 4px; text-align: center; font-size: 12px; color: #8696a0;">
            No media found in conversation.
          </div>
        </div>

        <div class="wmd-section">
          <p style="font-size: 12px; color: #8696a0; margin-bottom: 8px; text-align: center;">
            Select time range to scan:
          </p>
          <div class="wmd-time-filters" style="display: flex; gap: 8px; margin-bottom: 12px;">
            <button class="wmd-btn wmd-btn-filter" id="wmd-filter-1h" data-hours="1">
              🕐 1h
            </button>
            <button class="wmd-btn wmd-btn-filter" id="wmd-filter-3h" data-hours="3">
              🕒 3h
            </button>
            <button class="wmd-btn wmd-btn-filter" id="wmd-filter-24h" data-hours="24">
              📅 24h
            </button>
          </div>
          <button class="wmd-btn wmd-btn-primary wmd-btn-large" id="wmd-magic-scan-btn" disabled>
            ✨ Magic Scan
          </button>
          <p style="font-size: 12px; color: #8696a0; margin-top: 8px; text-align: center;">
            Select a time range first
          </p>
        </div>

        <div class="wmd-section">
          <button class="wmd-btn wmd-btn-success" id="wmd-download-btn" disabled>
            ⬇️ Download All
          </button>
        </div>

        <div class="wmd-section" style="padding-top: 0;">
          <label class="wmd-checkbox" style="display: flex; align-items: center; font-size: 12px;">
            <input type="checkbox" id="wmd-analytics-toggle">
            <span style="flex: 1;">📊 Share anonymous usage statistics</span>
          </label>
          <p style="font-size: 11px; color: #8696a0; margin-top: 4px; margin-bottom: 0;">
            Helps us improve the extension. No personal data collected.
          </p>
        </div>

        <div class="wmd-progress" id="wmd-progress" style="display: none;">
          <div class="wmd-progress-bar">
            <div class="wmd-progress-fill" id="wmd-progress-fill"></div>
          </div>
          <div class="wmd-progress-text" id="wmd-progress-text">0 / 0</div>
        </div>

        <div class="wmd-status" id="wmd-status">Click "Magic Scan" to start</div>
      </div>
    `;

    if (!document.body) {
      setTimeout(() => this.createUI(), 100);
      return;
    }

    document.body.appendChild(panel);
    this.ui = panel;

    const toggleButton = document.createElement('div');
    toggleButton.id = 'wmd-toggle';
    toggleButton.className = 'wmd-toggle';
    toggleButton.innerHTML = '📥';
    toggleButton.title = 'Instant Chat Media Downloader';
    document.body.appendChild(toggleButton);

    this.setupEventListeners();
  }

  setupEventListeners() {
    const closeBtn = document.getElementById('wmd-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.ui.classList.remove('wmd-panel-open');
        this.stopConversationMonitoring();
      });
    }

    const toggleBtn = document.getElementById('wmd-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        this.ui.classList.toggle('wmd-panel-open');
        const isOpen = this.ui.classList.contains('wmd-panel-open');

        if (isOpen) {
          this.mediaItems = {
            images: new Set(),
            documents: new Set()
          };
          this.documentButtons = new Map();
          this.downloadSessionFolder = null;
          this.isScanning = false;
      
          this.updateCounts();

          const status = document.getElementById('wmd-status');
          if (status) {
            status.textContent = 'Click "Magic Scan" to start';
            status.className = 'wmd-status';
          }

          const downloadBtn = document.getElementById('wmd-download-btn');
          if (downloadBtn) {
            downloadBtn.disabled = true;
          }

          const progress = document.getElementById('wmd-progress');
          if (progress) {
            progress.style.display = 'none';
          }

  
          this.startConversationMonitoring();

          // Show analytics consent modal if not yet answered
          if (this.analyticsConsent === null) {
            setTimeout(() => this.showAnalyticsConsentModal(), 500);
          }
        } else {
          this.stopConversationMonitoring();
        }
      });
    }

    // Analytics toggle listener
    const analyticsToggle = document.getElementById('wmd-analytics-toggle');
    if (analyticsToggle) {
      analyticsToggle.addEventListener('change', () => {
        this.saveAnalyticsConsent(analyticsToggle.checked);
      });
    }

    const filterButtons = document.querySelectorAll('.wmd-btn-filter');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const hours = parseInt(btn.getAttribute('data-hours'));

        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.selectedTimeRangeHours = hours;

        const magicScanBtn = document.getElementById('wmd-magic-scan-btn');
        if (magicScanBtn) {
          magicScanBtn.disabled = false;
        }

        const helpText = magicScanBtn?.nextElementSibling;
        if (helpText) {
          helpText.textContent = `Scanning messages from the last ${hours}h`;
        }

        const timeRangeText = document.getElementById('wmd-time-range-text');
        if (timeRangeText) {
          timeRangeText.textContent = `Last ${hours} hour${hours > 1 ? 's' : ''}`;
        }
      });
    });

    const magicScanBtn = document.getElementById('wmd-magic-scan-btn');
    if (magicScanBtn) {
      magicScanBtn.addEventListener('click', () => {
        this.startQuickScan();
      });
    }

    const downloadBtn = document.getElementById('wmd-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.startDownload();
      });
    }
  }

  setupMutationObserver() {
    const chatContainer = document.querySelector(this.selectors.chatContainer);
    if (!chatContainer) return;

    this.observer = new MutationObserver((mutations) => {
      if (this.isScanning) {
        this.scanCurrentView().catch(err => {});
      }
    });

    this.observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }

  async startQuickScan() {
    if (this.isScanning) {
      return;
    }

    this.isScanning = true;
    this.mediaItems = {
      images: new Set(),
      documents: new Set()
    };
    this.documentButtons = new Map();

    this.timeRangeHours = this.selectedTimeRangeHours || 24;
    this.conversationName = this.getConversationName();

    const status = document.getElementById('wmd-status');

    status.textContent = `Scanning messages from last ${this.timeRangeHours}h...`;
    status.className = 'wmd-status wmd-status-info';

    try {
      const chatContainer = document.querySelector('[data-testid="conversation-panel-body"]') ||
                           document.querySelector('[role="application"]');

      if (!chatContainer) {
        await this.sleep(1000);
      }

      await this.sleep(500);
      await this.scanCurrentView();

      await this.sleep(300);
      await this.scanCurrentView();

      await this.sleep(200);
      await this.scanCurrentView();

      this.updateCounts();

      const total = this.getTotalMediaCount();
      const imagesCount = this.mediaItems.images.size;
      const documentsCount = this.mediaItems.documents.size;

      if (total > 0) {
        status.textContent = `✅ Found ${total} files (${imagesCount} images, ${documentsCount} documents)`;
        status.className = 'wmd-status wmd-status-success';
        this.setDownloadButtonsDisabled(false);
      } else {
        status.textContent = 'No media found. Try a wider time range.';
        status.className = 'wmd-status wmd-status-info';
      }

      this.autoScanDone = true;

      // Send analytics event
      this.sendAnalyticsEvent('magic_scan', total);

    } catch (error) {
      status.textContent = '❌ Error during scan';
      status.className = 'wmd-status wmd-status-error';
    } finally {
      this.isScanning = false;
    }
  }

  getMessageTimestamp(element) {
    // Strategy 1: Use role="row" (WhatsApp virtual list message boundary)
    const row = element.closest('[role="row"]');
    if (row) {
      const ts = this._extractTimestampFromContainer(row);
      if (ts) return ts;
    }

    // Strategy 2: Use data-testid="msg-container" or similar
    const msgContainer = element.closest('[data-testid="msg-container"]');
    if (msgContainer) {
      // Search msg-container AND its parent (msg-meta may be a sibling)
      const ts = this._extractTimestampFromContainer(msgContainer)
              || this._extractTimestampFromContainer(msgContainer.parentElement);
      if (ts) return ts;
    }

    // Strategy 3: Walk up manually, limited to 15 levels
    let current = element.parentElement;
    for (let i = 0; i < 15 && current && current !== document.body; i++) {
      const ts = this._extractTimestampFromContainer(current);
      if (ts) return ts;
      current = current.parentElement;
    }

    return null;
  }

  _extractTimestampFromContainer(container) {
    if (!container) return null;

    // Method 1: data-pre-plain-text (full date+time, if it exists)
    const prePlain = container.querySelector?.('[data-pre-plain-text]');
    if (prePlain) {
      const text = prePlain.getAttribute('data-pre-plain-text');
      const match = text.match(/\[(\d{1,2}:\d{2})(?:[^,]*)?,\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]/);
      if (match) {
        const [_, time, date] = match;
        const [day, month, year] = date.split('/').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const fullYear = year < 100 ? 2000 + year : year;
        return new Date(fullYear, month - 1, day, hours, minutes);
      }
    }

    // Method 2: Search spans for visible time text (HH:MM)
    // WhatsApp displays message time in small spans near the message content.
    // We look for short text that starts with a time pattern.
    const allSpans = container.querySelectorAll?.('span');
    if (allSpans) {
      for (const span of allSpans) {
        const text = span.textContent?.trim() || '';
        if (text.length < 20) {
          const timeMatch = text.match(/^(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
              const now = new Date();
              return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
            }
          }
        }
      }
    }

    return null;
  }

  async scanCurrentView() {
    try {
      const chatContainer = document.querySelector(this.selectors.chatContainer) ||
                          document.querySelector('#main');

      if (!chatContainer) {
        return;
      }

      const allImages = chatContainer.querySelectorAll('img');

      const images = Array.from(allImages).filter(img => {
        const src = img.src || img.getAttribute('src') || '';

        const isWhatsAppImage = src.includes('blob:') ||
               src.includes('mmg.whatsapp.net') ||
               src.includes('whatsapp.net');

        if (!isWhatsAppImage) return false;

        // Exclude profile picture CDN (pps = profile picture service)
        if (src.includes('pps.whatsapp.net')) return false;

        const isInHeader = img.closest('header') !== null;
        const isInConversationInfo = img.closest('[data-testid="conversation-info-header"]') !== null;
        const isInSidebar = img.closest('[data-testid="chat-list"]') !== null;

        if (isInHeader || isInConversationInfo || isInSidebar) return false;

        // Exclude small images: avatars/profile pics inside messages are ~33-49px
        const w = img.width || img.naturalWidth || 0;
        const h = img.height || img.naturalHeight || 0;
        if (w > 0 && h > 0 && w < 70 && h < 70) return false;

        // Exclude images inside known avatar containers
        if (img.closest('[data-testid*="avatar"]') ||
            img.closest('[data-testid="photo-btn"]') ||
            img.closest('[data-testid="default-user"]')) return false;

        return true;
      });

      for (let index = 0; index < images.length; index++) {
        const img = images[index];
        try {
          const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';

          if (!src || src.length === 0) {
            continue;
          }

          if (src.includes('avatar') ||
              src.includes('emoji') ||
              src.includes('icon') ||
              src.includes('profile') ||
              src.includes('status')) {
            continue;
          }

          if (this.timeRangeHours) {
            const msgTime = this.getMessageTimestamp(img);
            if (!msgTime) {
              continue;
            }
            const cutoff = new Date(Date.now() - this.timeRangeHours * 60 * 60 * 1000);
            if (msgTime < cutoff) continue;
          }

          if (this.mediaItems.documents.has(src)) {
            this.mediaItems.documents.delete(src);
          }

          this.mediaItems.images.add(src);
        } catch (e) {
        }
      }

      const documentButtons = chatContainer.querySelectorAll('div[role="button"], [data-testid="media-document"], [data-testid*="document"]');

      for (const button of documentButtons) {
        try {
          const buttonText = button.textContent || '';
          const hasDocExtension = buttonText.match(/\.(pdf|doc|docx|xls|xlsx|txt|ppt|pptx|zip|rar)/i);
          const hasPages = buttonText.match(/\d+\s*(página|pagina|page|pág)/i);
          const hasSize = buttonText.match(/\d+(\.\d+)?\s*(KB|MB|GB)/i);

          if (!hasDocExtension && !hasPages && !hasSize) {
            continue;
          }

          if (this.timeRangeHours) {
            const msgTime = this.getMessageTimestamp(button);
            if (!msgTime) {
              continue;
            }
            const cutoff = new Date(Date.now() - this.timeRangeHours * 60 * 60 * 1000);
            if (msgTime < cutoff) continue;
          }

          let title = 'document';
          const fileNameMatch = buttonText.match(/([^\n]+\.(pdf|doc|docx|xls|xlsx|txt|ppt|pptx|zip|rar))/i);
          if (fileNameMatch) {
            title = fileNameMatch[1].trim();
          } else {
            const titleAttr = button.getAttribute('title') ||
                            button.querySelector('[title]')?.getAttribute('title') || '';
            if (titleAttr) {
              title = titleAttr;
            }
          }

          let alreadyExists = false;
          for (const doc of this.mediaItems.documents) {
            try {
              const parsed = JSON.parse(doc);
              if (parsed.title === title) {
                alreadyExists = true;
                break;
              }
            } catch (e) {}
          }

          if (alreadyExists) {
            continue;
          }

          const buttonId = `doc_btn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          if (!this.documentButtons) {
            this.documentButtons = new Map();
          }
          this.documentButtons.set(buttonId, button);

          this.mediaItems.documents.add(JSON.stringify({
            id: buttonId,
            title: title,
            type: 'element_reference'
          }));
        } catch (e) {
        }
      }

    } catch (error) {
    }
  }


  updateCounts() {
    const imageCount = document.getElementById('wmd-count-images');
    const docCount = document.getElementById('wmd-count-documents');

    if (imageCount) {
      imageCount.textContent = this.mediaItems.images.size;
    }
    if (docCount) {
      docCount.textContent = this.mediaItems.documents.size;
    }
  }

  getTotalMediaCount() {
    return this.mediaItems.images.size + this.mediaItems.documents.size;
  }

  setDownloadButtonsDisabled(disabled) {
    const downloadBtn = document.getElementById('wmd-download-btn');
    if (downloadBtn) downloadBtn.disabled = disabled;
  }

  async startDownload() {
    if (this.isDownloading) return;

    if (!this.downloadWarningShown) {
      const status = document.getElementById('wmd-status');
      status.innerHTML = `
        ℹ️ <strong>First download:</strong> If Chrome asks you to confirm each file,
        go to <code>chrome://settings/downloads</code> and uncheck
        "Ask where to save each file before downloading".
        <br><small>This message appears only once.</small>
      `;
      status.className = 'wmd-status wmd-status-info';
      await this.sleep(5000);
      this.downloadWarningShown = true;
    }

    this.isDownloading = true;
    this.downloadQueue = [];

    if (!this.conversationName) {
      this.conversationName = this.getConversationName();
    }
    this.downloadSessionFolder = this.sanitizeFolderName(this.conversationName);

    const progress = document.getElementById('wmd-progress');
    const status = document.getElementById('wmd-status');

    this.setDownloadButtonsDisabled(true);
    progress.style.display = 'block';

    this.mediaItems.images.forEach(url => {
      this.downloadQueue.push({ type: 'image', url });
    });

    this.mediaItems.documents.forEach(doc => {
      try {
        const parsed = JSON.parse(doc);
        if (parsed.type === 'element_reference') {
          this.downloadQueue.push({ type: 'document', id: parsed.id, title: parsed.title });
        } else {
          this.downloadQueue.push({ type: 'document', url: doc });
        }
      } catch (e) {
        this.downloadQueue.push({ type: 'document', url: doc });
      }
    });

    status.textContent = `Downloading ${this.downloadQueue.length} files...`;
    status.className = 'wmd-status wmd-status-info';

    let downloaded = 0;
    let errors = 0;

    for (let i = 0; i < this.downloadQueue.length; i++) {
      const item = this.downloadQueue[i];

      try {
        await this.downloadFile(item);
        downloaded++;
      } catch (error) {
        errors++;
        this.sendAnalyticsEvent('download_error', 1, {
          file_type: item.type || 'unknown',
          error_message: (error.message || 'unknown').substring(0, 200)
        });
      }

      const progressPercent = ((i + 1) / this.downloadQueue.length) * 100;
      document.getElementById('wmd-progress-fill').style.width = progressPercent + '%';
      document.getElementById('wmd-progress-text').textContent =
        `${downloaded} / ${this.downloadQueue.length} (${errors} errors)`;

      await this.sleep(200);
    }

    status.textContent = `✅ Download complete: ${downloaded} files (${errors} errors)`;
    status.className = 'wmd-status wmd-status-success';

    this.isDownloading = false;
    this.downloadSessionFolder = null;
    this.setDownloadButtonsDisabled(false);

    setTimeout(() => {
      progress.style.display = 'none';
      this.resetToInitialState();
    }, 3000);
  }

  async downloadFile(item) {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (item.id && this.documentButtons) {
          const button = this.documentButtons.get(item.id);
          if (!button) {
            throw new Error('Document button not found in DOM');
          }

          button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
          await this.sleep(300);

          let downloadButton = button.querySelector('[data-icon="download"]') ||
                              button.querySelector('[aria-label*="download"]') ||
                              button.querySelector('[aria-label*="Download"]') ||
                              button.querySelector('[aria-label*="descargar"]') ||
                              button.querySelector('[aria-label*="Descargar"]');

          if (!downloadButton) {
            const messageContainer = button.closest('[data-testid="msg-container"]') ||
                                    button.closest('[data-id]') ||
                                    button.parentElement;
            if (messageContainer) {
              messageContainer.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
              await this.sleep(300);

              downloadButton = messageContainer.querySelector('[data-icon="download"]') ||
                             messageContainer.querySelector('[aria-label*="download"]') ||
                             messageContainer.querySelector('[aria-label*="Download"]') ||
                             messageContainer.querySelector('[aria-label*="descargar"]') ||
                             messageContainer.querySelector('[aria-label*="Descargar"]');
            }
          }

          if (downloadButton) {
            downloadButton.click();
          } else {
            button.click();
          }
          const docExt = (item.title || '').match(/\.(\w+)$/);
          this.sendAnalyticsEvent('file_download', 1, { file_type: docExt ? docExt[1].toLowerCase() : 'unknown' });
          await this.sleep(1000);
          return;
        } else if (item.url) {
          const response = await fetch(item.url);
          const blob = await response.blob();

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          let extension = '.jpg';

          if (item.type === 'image') {
            if (blob.type.includes('png')) {
              extension = '.png';
            } else if (blob.type.includes('gif')) {
              extension = '.gif';
            } else if (blob.type.includes('webp')) {
              extension = '.webp';
            }
          } else {
            extension = '.pdf';
          }

          const filename = `whatsapp/${this.downloadSessionFolder}/whatsapp_${item.type}_${timestamp}${extension}`;
          this.sendAnalyticsEvent('file_download', 1, { file_type: extension.replace('.', '') });

          const url = URL.createObjectURL(blob);

          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'download',
              url: url,
              filename: filename
            });
          } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          await this.sleep(5000);
          URL.revokeObjectURL(url);
          return;
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        await this.sleep(500);
      }
    }
  }

  resetToInitialState() {
    this.selectedTimeRangeHours = null;

    const filterButtons = document.querySelectorAll('.wmd-btn-filter');
    filterButtons.forEach(btn => btn.classList.remove('active'));

    const magicScanBtn = document.getElementById('wmd-magic-scan-btn');
    if (magicScanBtn) {
      magicScanBtn.disabled = true;
    }

    const helpText = magicScanBtn?.nextElementSibling;
    if (helpText) {
      helpText.textContent = 'Select a time range first';
    }

    this.mediaItems = {
      images: new Set(),
      documents: new Set()
    };

    if (this.documentButtons) {
      this.documentButtons.clear();
    }

    const imageCount = document.getElementById('wmd-count-images');
    const docCount = document.getElementById('wmd-count-documents');
    if (imageCount) imageCount.textContent = '0';
    if (docCount) docCount.textContent = '0';

    const status = document.getElementById('wmd-status');
    if (status) {
      status.textContent = 'Ready for new scan';
      status.className = 'wmd-status wmd-status-info';
    }

    this.setDownloadButtonsDisabled(true);

    const progressFill = document.getElementById('wmd-progress-fill');
    if (progressFill) {
      progressFill.style.width = '0%';
    }

    const timeRangeText = document.getElementById('wmd-time-range-text');
    if (timeRangeText) {
      timeRangeText.textContent = 'All messages';
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send analytics event to backend (only if user consented)
   * @param {string} eventName - Event name (magic_scan or full_scan)
   * @param {number} totalItems - Number of items found
   */
  sendAnalyticsEvent(eventName, totalItems, extraData = {}) {
    if (this.analyticsConsent !== true) {
      return;
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'sendAnalytics',
          event: eventName,
          total_items: totalItems,
          timestamp: Math.floor(Date.now() / 1000),
          ...extraData
        });
      }
    } catch (e) {
      // Silently fail - analytics should not break the extension
    }
  }
}

(function() {
  function initDownloader() {
    try {
      const downloader = new InstantChatMediaDownloader();
      downloader.init();
    } catch (error) {
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDownloader);
  } else {
    initDownloader();
  }
})();

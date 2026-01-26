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
    this.stopScanning = false;
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
        this.stopScanning = false;

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

        this.collapseAdvancedOptions();

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

        this.collapseAdvancedOptions();
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
              <li>Number of scans performed (Magic Scan / Full Scan)</li>
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
          <p class="wmd-modal-note">You can change this setting anytime in Advanced Options.</p>
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
        <h3>📥 Instant Chat Media Downloader</h3>
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

        <div class="wmd-advanced-toggle" id="wmd-advanced-toggle">
          <button class="wmd-btn-link">⚙️ Advanced Options (Pro)</button>
        </div>

        <div class="wmd-advanced" id="wmd-advanced" style="display: none;">
          <div class="wmd-section">
            <h4>Media Types:</h4>

            <div style="margin-bottom: 12px;">
              <label class="wmd-checkbox" style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                <input type="checkbox" id="wmd-images-check" checked>
                <span style="flex: 1;">🖼️ Images</span>
              </label>
              <div id="wmd-images-subtypes" style="margin-left: 24px; display: block;">
                <label class="wmd-checkbox wmd-subtype-item" data-subtype="jpg">
                  <input type="checkbox" id="wmd-images-jpg" checked>
                  <span>JPG/JPEG</span>
                </label>
                <label class="wmd-checkbox wmd-subtype-item" data-subtype="png">
                  <input type="checkbox" id="wmd-images-png" checked>
                  <span>PNG</span>
                </label>
              </div>
            </div>

            <div>
              <label class="wmd-checkbox" style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
                <input type="checkbox" id="wmd-documents-check" checked>
                <span style="flex: 1;">📄 Documents</span>
              </label>
              <div id="wmd-documents-subtypes" style="margin-left: 24px; display: block;">
                <label class="wmd-checkbox wmd-subtype-item" data-subtype="pdf">
                  <input type="checkbox" id="wmd-docs-pdf" checked>
                  <span>PDF</span>
                </label>
                <label class="wmd-checkbox wmd-subtype-item" data-subtype="doc">
                  <input type="checkbox" id="wmd-docs-doc" checked>
                  <span>DOC/DOCX</span>
                </label>
                <label class="wmd-checkbox wmd-subtype-item" data-subtype="xls">
                  <input type="checkbox" id="wmd-docs-xls" checked>
                  <span>XLS/XLSX</span>
                </label>
                <label class="wmd-checkbox wmd-subtype-item" data-subtype="txt">
                  <input type="checkbox" id="wmd-docs-txt" checked>
                  <span>TXT</span>
                </label>
              </div>
            </div>
          </div>

          <div class="wmd-section">
            <h4>Full Scan & Download:</h4>
            <button class="wmd-btn wmd-btn-primary" id="wmd-rescan-btn">
              🔍 Full Scan
            </button>
            <button class="wmd-btn wmd-btn-danger" id="wmd-stop-scan-btn" style="display: none; margin-top: 8px;">
              ⏹️ STOP Scan
            </button>
            <p style="font-size: 12px; color: #8696a0; margin-top: 8px; margin-bottom: 0;">
              ⚠️ Scrolls through conversation. Click STOP when you have enough files.
            </p>
            <button class="wmd-btn wmd-btn-success" id="wmd-download-advanced-btn" disabled style="margin-top: 8px;">
              ⬇️ Download All
            </button>
          </div>

          <div class="wmd-section">
            <h4>📊 Analytics:</h4>
            <label class="wmd-checkbox" style="display: flex; align-items: center;">
              <input type="checkbox" id="wmd-analytics-toggle">
              <span style="flex: 1;">Share anonymous usage statistics</span>
            </label>
            <p style="font-size: 11px; color: #8696a0; margin-top: 4px; margin-bottom: 0;">
              Helps us improve the extension. No personal data collected.
            </p>
          </div>
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
          this.stopScanning = false;
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

          this.collapseAdvancedOptions();
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

    const advancedToggle = document.getElementById('wmd-advanced-toggle');
    if (advancedToggle) {
      advancedToggle.addEventListener('click', () => {
        const advancedPanel = document.getElementById('wmd-advanced');
        const magicScanBtn = document.getElementById('wmd-magic-scan-btn');
        const magicScanSection = magicScanBtn?.closest('.wmd-section');
        const downloadBtn = document.getElementById('wmd-download-btn');
        const downloadSection = downloadBtn?.closest('.wmd-section');

        if (advancedPanel) {
          const isHidden = advancedPanel.style.display === 'none';
          advancedPanel.style.display = isHidden ? 'block' : 'none';

          if (isHidden) {
            if (magicScanSection) magicScanSection.style.display = 'none';
            if (downloadSection) downloadSection.style.display = 'none';

            this.mediaItems = {
              images: new Set(),
              documents: new Set()
            };
            this.documentButtons = new Map();
            this.updateCounts();

            const status = document.getElementById('wmd-status');
            if (status) {
              status.textContent = 'Click "Full Scan" to start';
              status.className = 'wmd-status';
            }

            this.setDownloadButtonsDisabled(true);

            const progress = document.getElementById('wmd-progress');
            if (progress) {
              progress.style.display = 'none';
            }
          } else {
            if (magicScanSection) magicScanSection.style.display = 'block';
            if (downloadSection) downloadSection.style.display = 'block';
          }
        }
      });
    }

    const rescanBtn = document.getElementById('wmd-rescan-btn');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', () => {
        this.startFullScan();
      });
    }

    const stopBtn = document.getElementById('wmd-stop-scan-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stopScanning = true;
        stopBtn.style.display = 'none';
        document.getElementById('wmd-status').textContent = 'Scan stopped by user';
        document.getElementById('wmd-status').className = 'wmd-status wmd-status-info';
      });
    }

    const imagesCheck = document.getElementById('wmd-images-check');
    if (imagesCheck) {
      imagesCheck.addEventListener('change', () => {
        const subChecks = ['wmd-images-jpg', 'wmd-images-png'];
        subChecks.forEach(id => {
          const checkbox = document.getElementById(id);
          if (checkbox) checkbox.checked = imagesCheck.checked;
        });
      });
    }

    const docsCheck = document.getElementById('wmd-documents-check');
    if (docsCheck) {
      docsCheck.addEventListener('change', () => {
        const subChecks = ['wmd-docs-pdf', 'wmd-docs-doc', 'wmd-docs-xls', 'wmd-docs-txt'];
        subChecks.forEach(id => {
          const checkbox = document.getElementById(id);
          if (checkbox) checkbox.checked = docsCheck.checked;
        });
      });
    }

    const downloadBtn = document.getElementById('wmd-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.startDownload();
      });
    }

    const downloadAdvancedBtn = document.getElementById('wmd-download-advanced-btn');
    if (downloadAdvancedBtn) {
      downloadAdvancedBtn.addEventListener('click', () => {
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

      status.textContent = `✅ Found ${total} files (${imagesCount} images, ${documentsCount} documents)`;
      status.className = 'wmd-status wmd-status-success';

      if (total > 0) {
        this.setDownloadButtonsDisabled(false);
      } else {
        status.textContent = `No media found. Try "Full Scan" in Advanced Options.`;
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

  async startFullScan() {
    if (this.isScanning) {
      return;
    }

    this.isScanning = true;
    this.stopScanning = false;
    this.mediaItems = {
      images: new Set(),
      documents: new Set()
    };
    this.documentButtons = new Map();

    this.conversationName = this.getConversationName();

    const status = document.getElementById('wmd-status');
    const stopBtn = document.getElementById('wmd-stop-scan-btn');
    const fullScanBtn = document.getElementById('wmd-rescan-btn');

    if (stopBtn) stopBtn.style.display = 'block';
    if (fullScanBtn) fullScanBtn.style.display = 'none';

    status.textContent = 'Full scan in progress (scrolling)... Click STOP anytime';
    status.className = 'wmd-status wmd-status-info';

    try {
      await this.scanCurrentView();
      await this.scrollAndScan();

      this.updateCounts();

      const total = this.getTotalMediaCount();

      status.textContent = `✅ Full scan complete: ${total} files found`;
      status.className = 'wmd-status wmd-status-success';

      if (total > 0) {
        this.setDownloadButtonsDisabled(false);
      } else {
        status.textContent = `No media found in conversation.`;
        status.className = 'wmd-status wmd-status-info';
      }

      this.autoScanDone = true;

      // Send analytics event
      this.sendAnalyticsEvent('full_scan', total);

    } catch (error) {
      status.textContent = '❌ Error during full scan';
      status.className = 'wmd-status wmd-status-error';
    } finally {
      this.isScanning = false;
      this.stopScanning = false;
      if (stopBtn) stopBtn.style.display = 'none';
      if (fullScanBtn) fullScanBtn.style.display = 'block';
    }
  }

  async scrollAndScan() {
    const chatContainer = document.querySelector(this.selectors.chatContainer);
    if (!chatContainer) return;

    const scrollStep = 800;
    const scrollDelay = 500;
    const maxScrolls = 100;

    let scrollCount = 0;
    let previousScrollTop = -1;

    while (scrollCount < maxScrolls && !this.stopScanning) {
      scrollCount++;

      chatContainer.scrollTop = Math.max(0, chatContainer.scrollTop - scrollStep);

      await this.sleep(scrollDelay);

      await this.scanCurrentView();
      this.updateCounts();

      if (chatContainer.scrollTop === previousScrollTop || chatContainer.scrollTop === 0) {
        break;
      }

      previousScrollTop = chatContainer.scrollTop;
    }
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
               src.includes('pps.whatsapp.net') ||
               src.includes('whatsapp.net');

        if (!isWhatsAppImage) return false;

        const isInHeader = img.closest('header') !== null;
        const isInConversationInfo = img.closest('[data-testid="conversation-info-header"]') !== null;
        const isInSidebar = img.closest('[data-testid="chat-list"]') !== null;

        return !isInHeader && !isInConversationInfo && !isInSidebar;
      });

      const selectedTypes = this.getSelectedFileTypes();

      const imagesCheck = document.getElementById('wmd-images-check');
      const shouldScanImages = imagesCheck ? imagesCheck.checked : true;

      if (shouldScanImages) {
        const hasImageTypeFilter = selectedTypes.images.size > 0;

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

            if (hasImageTypeFilter) {
              const srcLower = src.toLowerCase();
              let shouldInclude = false;

              if (srcLower.includes('.jpg') || srcLower.includes('.jpeg') || srcLower.includes('jpeg')) {
                shouldInclude = selectedTypes.images.has('jpg');
              } else if (srcLower.includes('.png') || srcLower.includes('/png')) {
                shouldInclude = selectedTypes.images.has('png');
              } else if (srcLower.includes('blob:') || srcLower.includes('whatsapp.net')) {
                try {
                  const response = await fetch(src);
                  if (!response.ok) {
                    continue;
                  }

                  const blob = await response.blob();
                  const contentType = blob.type || '';

                  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                    shouldInclude = selectedTypes.images.has('jpg');
                  } else if (contentType.includes('png')) {
                    shouldInclude = selectedTypes.images.has('png');
                  } else {
                    continue;
                  }
                } catch (fetchError) {
                  continue;
                }
              } else {
                continue;
              }

              if (!shouldInclude) {
                continue;
              }
            }

            if (this.mediaItems.documents.has(src)) {
              this.mediaItems.documents.delete(src);
            }

            this.mediaItems.images.add(src);
          } catch (e) {
          }
        }
      }

      const docsCheck = document.getElementById('wmd-documents-check');
      const shouldScanDocs = docsCheck ? docsCheck.checked : true;

      if (shouldScanDocs) {
        const hasDocTypeFilter = selectedTypes.documents.size > 0;

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

            if (hasDocTypeFilter) {
              const shouldInclude = this.shouldIncludeDocument({ title: title }, selectedTypes.documents);
              if (!shouldInclude) {
                continue;
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
      }

    } catch (error) {
    }
  }

  getSelectedFileTypes() {
    const types = {
      images: new Set(),
      documents: new Set()
    };

    if (document.getElementById('wmd-images-jpg')?.checked) {
      types.images.add('jpg');
    }
    if (document.getElementById('wmd-images-png')?.checked) {
      types.images.add('png');
    }

    if (document.getElementById('wmd-docs-pdf')?.checked) {
      types.documents.add('pdf');
    }
    if (document.getElementById('wmd-docs-doc')?.checked) {
      types.documents.add('doc');
      types.documents.add('docx');
    }
    if (document.getElementById('wmd-docs-xls')?.checked) {
      types.documents.add('xls');
      types.documents.add('xlsx');
    }
    if (document.getElementById('wmd-docs-txt')?.checked) {
      types.documents.add('txt');
    }

    return types;
  }

  shouldIncludeDocument(doc, selectedTypes) {
    if (!selectedTypes || selectedTypes.size === 0) {
      return true;
    }

    const title = (doc.title || doc.url || '').toLowerCase();

    if (title.includes('.pdf') || title.includes('pdf')) {
      return selectedTypes.has('pdf');
    }
    if (title.includes('.doc') || title.includes('.docx')) {
      return selectedTypes.has('doc') || selectedTypes.has('docx');
    }
    if (title.includes('.xls') || title.includes('.xlsx')) {
      return selectedTypes.has('xls') || selectedTypes.has('xlsx');
    }
    if (title.includes('.txt')) {
      return selectedTypes.has('txt');
    }

    return true;
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
    const downloadAdvancedBtn = document.getElementById('wmd-download-advanced-btn');

    if (downloadBtn) downloadBtn.disabled = disabled;
    if (downloadAdvancedBtn) downloadAdvancedBtn.disabled = disabled;
  }

  collapseAdvancedOptions() {
    const advancedPanel = document.getElementById('wmd-advanced');
    const magicScanBtn = document.getElementById('wmd-magic-scan-btn');
    const magicScanSection = magicScanBtn?.closest('.wmd-section');
    const downloadBtn = document.getElementById('wmd-download-btn');
    const downloadSection = downloadBtn?.closest('.wmd-section');

    if (advancedPanel) {
      advancedPanel.style.display = 'none';
    }
    if (magicScanSection) {
      magicScanSection.style.display = 'block';
    }
    if (downloadSection) {
      downloadSection.style.display = 'block';
    }
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

    const selectedTypes = this.getSelectedFileTypes();

    const imagesCheck = document.getElementById('wmd-images-check');
    const docsCheck = document.getElementById('wmd-documents-check');

    const downloadImages = imagesCheck ? imagesCheck.checked : true;
    const downloadDocs = docsCheck ? docsCheck.checked : true;

    if (downloadImages) {
      this.mediaItems.images.forEach(url => {
        this.downloadQueue.push({ type: 'image', url });
      });
    }

    if (downloadDocs) {
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
    }

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
          if (button) {
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
              await this.sleep(1000);
              return;
            } else {
              button.click();
              await this.sleep(1000);
              return;
            }
          }
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

          await this.sleep(100);
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
  sendAnalyticsEvent(eventName, totalItems) {
    // Only send if user explicitly consented
    if (this.analyticsConsent !== true) {
      return;
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'sendAnalytics',
          event: eventName,
          total_items: totalItems,
          timestamp: Math.floor(Date.now() / 1000)
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

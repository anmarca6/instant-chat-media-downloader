# Changelog

All notable changes to Instant Chat Media Downloader.

## [1.11.0] - 2025-12-22

### 🎉 Major Feature: Combine PDF (PDF Merge)

**Perfect for print shops! Merge multiple PDF documents into a single consolidated file.**

### Added
- **Combine PDF Feature** - Merge multiple PDF files into one document
  - Preserves all original pages exactly as received
  - No rasterization, no recompression, no modification
  - Maintains original page size, orientation, and resolution
  - Pages ordered sequentially based on source document order

### Features
- **Supported Formats**: PDF only (.pdf)
  - Explicitly excludes: Images (JPG, PNG), Office documents (DOC, DOCX, XLS, PPT)
  - Non-PDF files are silently ignored
- **Quality Preservation**:
  - No visual or structural differences
  - Bitwise-correct at page content level
  - Identical print results
  - Preserves:
    - Page dimensions
    - Orientation
    - Content streams
    - Embedded images
    - Vector graphics
    - Fonts (embedded as-is)
- **PDF Naming**: `ChatName_YYYY-MM-DD_Combined.pdf` (e.g., `Hijo_1_2025-12-22_Combined.pdf`)
  - Fallback: `WhatsApp_Combined_YYYY-MM-DD.pdf`
- **Client-Side Processing**:
  - All processing happens in browser
  - No external servers
  - No data sent anywhere
  - pdf-lib library (reuses from PDF Export)

### Technical
- Uses pdf-lib library (v1.17.1) - reuses if already loaded
- Sequential PDF processing to avoid memory spikes
- Handles up to 50+ PDFs efficiently
- Progress updates during merge
- Error handling for invalid PDFs

### User Experience
- Button enabled only when 2+ PDFs are available
- Real-time progress: "Processing PDF X/Y..."
- Clear success/error messages
- PDF saved to: `whatsapp/[conversation]/ChatName_YYYY-MM-DD_Combined.pdf`
- Shows total pages merged: "✅ PDFs merged: filename.pdf (X pages from Y PDFs)"

### Limitations
- Documents without direct URLs (click-based downloads) are skipped
- Requires at least 2 PDFs to merge
- Password-protected PDFs may fail (out of scope v1)

## [1.10.0] - 2025-12-22

### 🎉 Major Feature: Print-Ready PDF Export (Images Only)

**Perfect for print shops! Convert multiple JPG/PNG images into a single print-ready PDF.**

### Added
- **Print-Ready PDF Export** - Convert JPG and PNG images into a single PDF file
  - One image = one PDF page
  - Page size = image physical size (calculated from pixels and DPI)
  - Preserves original image quality (no recompression, no resampling)
  - Zero margins, centered placement
  - RGB color space preserved

### Features
- **Supported Formats**: JPG/JPEG and PNG only
  - Explicitly excludes: WEBP, GIF, PDF documents, DOC/DOCX, PPT/XLS
- **Quality Preservation**:
  - No recompression
  - No resampling
  - No re-encoding
  - Original pixel dimensions preserved
  - 300 DPI default (print quality)
- **PDF Generation**:
  - Each image = one page
  - Page size calculated from: `(pixels / DPI) * 72 points`
  - Images embedded 1:1 without modification
- **PDF Naming**: `ChatName_YYYY-MM-DD.pdf` (e.g., `Hijo_1_2025-12-22.pdf`)
- **Client-Side Processing**:
  - All processing happens in browser
  - No external servers
  - No data sent anywhere
  - pdf-lib library loaded from CDN (jsdelivr)

### Technical
- Uses pdf-lib library (v1.17.1) from jsdelivr CDN
- Sequential image processing to avoid memory spikes
- Automatic type detection (MIME type + magic bytes)
- Handles up to 100+ images efficiently
- Progress updates during PDF generation
- Error handling for unsupported formats

### User Experience
- Button enabled only when images are available
- Real-time progress: "Processing X/Y images..."
- Clear success/error messages
- PDF saved to: `whatsapp/[conversation]/ChatName_YYYY-MM-DD.pdf`

## [1.9.0] - 2025-12-22

### 🎉 Major Feature: ZIP Download (Bulk Media Packaging)

**Perfect for print shops and businesses handling multiple files!**

### Added
- **ZIP Download Feature** - Package all selected files into a single ZIP archive
  - One-click download of all media as a single ZIP file
  - Preserves original file quality (no compression, no modification)
  - Original filenames preserved with sequential numbering
  - Files added in chronological order

### Features
- **ZIP Naming**: `ChatName_YYYY-MM-DD.zip` (e.g., `plus_34628614090_2025-12-22.zip`)
- **File Organization**: 
  - Images: `image_001.jpg`, `image_002.png`, etc.
  - Documents: `document_001.pdf`, `document_002.docx`, etc.
- **Quality Preservation**: 
  - No compression (STORE mode)
  - No file modification
  - Byte-identical to originals
- **Client-Side Processing**: 
  - All processing happens in browser
  - No external servers
  - No data sent anywhere
  - JSZip library loaded from CDN (jsdelivr)

### Technical
- Uses JSZip library (v3.10.1) from jsdelivr CDN
- Sequential file processing to avoid memory spikes
- Progress updates during ZIP generation
- Handles up to 100+ files efficiently
- Supports images (JPG, PNG, GIF, WebP) and documents (PDF, DOCX, XLSX, TXT, etc.)
- Documents without direct URLs are skipped (click-based downloads can't be included)

### User Experience
- Button enabled only when files are available
- Real-time progress: "Packaging X/Y files..."
- Clear success/error messages
- ZIP saved to same folder structure: `whatsapp/[conversation]/[zipfile]`

## [1.8.2] - 2025-12-22

### Fixed - Single Folder Per Download Session

**Problem:** Each file was creating a new folder because `sanitizeFolderName()` generates a new timestamp (with seconds) every time it's called.

**Solution:**
- **Generate folder name ONCE** at the start of `startDownload()`
- Store it in `this.downloadSessionFolder`
- Reuse the same folder name for ALL files in that download session
- Clear folder name when download session completes

**Result:**
- ✅ One folder per download session: `whatsapp/plus_34628614090_20251222_00h19m41s/`
- ✅ All images and documents from that session go to the same folder
- ✅ Next download session creates a new folder with new timestamp

**Example:**
```
Downloads/
  └── whatsapp/
      └── plus_34628614090_20251222_00h19m41s/
          ├── whatsapp_image_001.jpg
          ├── whatsapp_image_002.jpg
          ├── whatsapp_document_001.pdf
          └── whatsapp_document_002.pdf
```

**Technical:**
- Added `this.downloadSessionFolder` property
- Generate folder name once in `startDownload()`
- Reuse in `downloadFile()` for both images and documents
- Clear on download completion

## [1.8.1] - 2025-12-22

### Fixed - Document Download Folder Structure

**Problem:** Documents were downloading directly to Downloads root instead of organized folders.

**Solution:**
- **Enhanced document URL detection** - More exhaustive search for document URLs:
  - Checks button href directly
  - Searches all child elements for links
  - Checks all attributes for blob URLs or HTTP URLs
  - Better coverage of WhatsApp's DOM structure

- **Download interception system** - For documents without direct URLs:
  - Background script now intercepts downloads triggered by clicks
  - Automatically redirects to our folder structure: `whatsapp/[conversation]/[file]`
  - Uses `chrome.downloads.onCreated` listener to catch WhatsApp downloads
  - Cancels original download and creates new one with correct path

**Technical:**
- Added `prepareDownloadIntercept` message handler in background script
- Implemented download interception with 10-second timeout
- Improved document URL search with 4 different strategies
- Better logging for debugging download paths

**Note:** If document still downloads to root, check browser console for interception logs.

## [1.8.0] - 2025-12-22

### 🎉 Major Update: Advanced Options (Pro) Features

**New UI Structure for Pro Features (currently available for testing)**

### Added
- **Advanced Options (Pro)** - Renamed from "Advanced Options"
  - Collapsed by default (as before)
  - New organized structure for Pro features

- **Granular Media Type Selection**
  - **Images Group:**
    - Parent checkbox: "🖼️ Images" (controls all)
    - Individual checkboxes: JPG/JPEG, PNG, GIF, WebP
  - **Documents Group:**
    - Parent checkbox: "📄 Documents" (controls all)
    - Individual checkboxes: PDF, DOC/DOCX, XLS/XLSX, TXT, Other
  - Parent checkboxes automatically control child checkboxes

- **Full Scan & Download Section**
  - Reorganized existing Full Scan functionality
  - Same behavior: scrolls through history with STOP control

- **Print-Ready PDF Export** (Structure Ready)
  - New button: "📄 Export as PDF"
  - Currently shows "coming soon" message
  - Will combine all images into a single print-ready PDF
  - Button enabled only when images are available

- **ZIP Packaging** (Structure Ready)
  - New button: "📦 Package as ZIP"
  - Currently shows "coming soon" message
  - Will package all files into a single ZIP archive
  - Button enabled only when files are available

### Technical
- Added event listeners for granular checkboxes
- Parent checkboxes control child checkboxes automatically
- PDF and ZIP buttons enable/disable based on available media
- Prepared structure for future PDF and ZIP implementation
- Functions `exportToPDF()` and `exportToZIP()` created (placeholder for now)

### Notes
- All Pro features are currently available for testing
- PDF and ZIP export will be implemented in future versions
- Granular file type filtering will be implemented in download logic

## [1.7.5] - 2025-12-22

### Fixed - Folder Creation and Phone Number Handling

**Problem:** Folders not being created in Downloads, and `+` in phone numbers might cause issues.

**Solution:**
- **Replaced `+` with `plus_`** in folder names for better compatibility
  - Example: `+34628614090` → `plus_34628614090_20251222_00h19m41s`
- **Enhanced logging** for download paths to diagnose folder creation issues
- Better visibility into what path Chrome is receiving

**Known Limitation:**
- **Documents without direct URLs** use click-based download, which bypasses our folder system
- WhatsApp handles these downloads directly, so they go to default Downloads location
- Images with blob URLs should create folders correctly

**Technical:**
- Modified `sanitizeFolderName()` to replace `+` with `plus_`
- Added detailed logging in `downloadFile()` showing full path structure
- Logs now show: conversation name, sanitized folder, full path, file type

## [1.7.4] - 2025-12-22

### Fixed - Folder Structure for Downloads

**Problem:** Files were downloading to Downloads root instead of organized folders.

**Solution:**
- **Prioritized phone number detection** - Now searches for phone numbers FIRST before names
- Improved phone number pattern matching (more formats supported)
- Enhanced logging in background script to diagnose download paths
- Ensured folder structure: `whatsapp/[numero_telefono]_AAAAMMDD_HHhMMmSSs/`

**Folder Format:**
- Structure: `whatsapp/[conversation_id]_AAAAMMDD_HHhMMmSSs/[filename]`
- Example: `whatsapp/+34612345678_20251222_00h19m41s/whatsapp_image_001.jpg`
- Chrome should automatically create folders when filename includes path

**Technical:**
- Reordered `getConversationName()` to prioritize phone number detection
- Added more phone number patterns (international formats)
- Enhanced logging in `downloadFile()` background function
- Folder names use `sanitizeFolderName()` which includes timestamp

## [1.7.3] - 2025-12-22

### Fixed - Critical: Infinite Loop in Conversation Monitoring

**Problem:** Document count was fluctuating between 0 and 1 in an infinite loop, making the UI unusable.

**Root Cause:** `sanitizeFolderName()` includes seconds in the timestamp, so every time it was called (every 2 seconds during monitoring), it generated a different ID. The system thought the conversation changed and triggered a new scan, creating an infinite loop.

**Solution:**
- Created separate `sanitizeConversationId()` function that only sanitizes the name WITHOUT timestamp
- Use `sanitizeConversationId()` for conversation change detection (stable ID)
- Keep `sanitizeFolderName()` with timestamp only for actual folder creation during download

**Result:**
- Conversation monitoring now uses stable IDs
- No more infinite loops
- Timestamp still added to folder names when downloading (as intended)

### Technical
- New function: `sanitizeConversationId()` - name only, no timestamp
- Updated `checkConversationChange()` to use stable ID
- Folder names still include timestamp when downloading (correct behavior)

## [1.7.2] - 2025-12-22

### Fixed - Document Detection

**Problem:** Documents were not being detected or downloaded correctly.

**Solution:** Completely rewrote document detection and download logic:

- **Improved document detection** - Multiple strategies to find documents:
  1. Search for document buttons with icons (`data-icon="document"`, etc.)
  2. Search for elements with `data-testid` containing "document"
  3. Search for text content indicating documents (PDF, DOC, XLS)
  4. Find direct download links

- **Better URL extraction** - Now finds download URLs from:
  - Direct `href` attributes
  - `data-href`, `data-url`, `data-download-url` attributes
  - Links within document buttons

- **Click-based download fallback** - For documents without direct URLs:
  - Stores button reference
  - Simulates click on download button when downloading
  - Lets WhatsApp handle the download natively

- **Fixed download queue** - Properly handles both URL-based and element-based documents

### Technical
- Added `documentButtons` Map to store button references
- Enhanced `scanCurrentView()` with comprehensive document detection
- Updated `downloadFile()` to handle element clicks
- Better logging for debugging document detection

## [1.7.1] - 2025-12-22

### Changed
- **Improved folder name format** - More readable and compact
  - Old: `Hijo_1_2025_12_22_00-06`
  - New: `Hijo_1_20251222_00h06m30s`
  - Includes seconds for better uniqueness
  - Easier to read with `h`, `m`, `s` separators
  - Shorter and cleaner format

## [1.7.0] - 2025-12-20

### 🎉 Major UX Improvement: User Control

**Perfect for print shops and businesses!**

### Added
- **✨ Magic Scan button** - Main scanning action (manual, not automatic)
  - Scans only visible messages
  - Instant results
  - No scrolling, no waiting
  - Click it when you're ready
- **⏹️ STOP button for Full Scan** - Take control!
  - Appears during Full Scan
  - Stop anytime when you have enough files
  - No need to wait for complete history
  - You decide how much to scan

### Changed
- **Removed automatic auto-scan** - No more surprises when opening panel
- **Magic Scan is now manual** - You control when to scan
- Full Scan button stays in Advanced Options
- Better visual feedback with stop/start states

### Benefits for Print Shops
- Open panel → See customer name
- Click "Magic Scan" → See files (4 photos, etc.)
- Click "Download All" → Done!
- OR use "Full Scan" if you need older files (with STOP control)

### Technical
- Added `stopScanning` flag
- Modified `scrollAndScan()` to check stop flag on each iteration
- New UI elements: Magic Scan button (large), STOP button (danger)
- Removed auto-scan from panel open event

## [1.6.1] - 2025-12-20

### Fixed - Critical: Timestamp Detection Issues

**Problem:** The timestamp-based filtering (v1.6.0) was unreliable because WhatsApp Web's DOM structure changes frequently, causing:
- AutoScan finding 0 files when there were actually 4
- Full Scan detecting incorrect numbers
- Erratic behavior across different WhatsApp versions

**Solution:** Reverted to **simple, robust approach**:
- **AutoScan**: Scans all visible messages without timestamp filtering
- **Full Scan**: Scrolls through history without timestamp filtering
- No dependencies on WhatsApp's changing DOM structure
- Predictable and reliable behavior

### Technical
- Removed `timeRangeHours = 24` from AutoScan
- `scanCurrentView()` now has two modes:
  - No filter: Adds all found media (default for AutoScan)
  - With filter: Only for future features if needed
- More robust logging for debugging

### Recommendation
For print shop use case: Position conversation at the bottom before opening panel, so visible area shows most recent messages.

## [1.6.0] - 2025-12-20

### 🎯 Major Feature: Smart Auto-Scan for Business Workflows

**Perfect for print shops, copy centers, and businesses receiving files via WhatsApp!**

### Changed
- **Auto-scan now detects ONLY files from TODAY** (last 24 hours)
- No more confusion with old files - only fresh content
- Status message now shows: "✅ Found X files from today"
- Full Scan still available in Advanced Options for older files

### Why This Change?

This version is optimized for business use cases:

**Example: Print Shop Workflow**
1. Customer sends 4 photos via WhatsApp → "Please print these"
2. Shop owner opens conversation → Clicks extension
3. Auto-scan finds exactly those 4 new photos (nothing else)
4. One-click download → Print → Done!

**Benefits:**
- ✅ No duplicates from previous orders
- ✅ No confusion with old files
- ✅ Fast and predictable
- ✅ Perfect for daily workflows
- ✅ Same customer can send files tomorrow - only new files detected

### Use Cases
- 🖨️ Print shops receiving photos to print
- 📄 Copy centers receiving documents
- 🏢 Businesses processing daily file submissions
- 📸 Photographers receiving client selections
- 🎨 Design agencies receiving client assets

### Technical
- Set `timeRangeHours = 24` for auto-scan
- Uses existing timestamp detection infrastructure
- Filters out any file older than 24 hours
- Full Scan bypasses time filter for complete history

## [1.5.3] - 2025-12-20

### Changed - Better User Experience! 🎉
- **AutoScan now ONLY scans visible messages** (fast, non-intrusive)
- No more automatic scrolling that loses your place in the conversation!
- Added "Full Scan" button in Advanced Options for when you need complete history
- "Full Scan" scrolls through conversation ONLY when you explicitly click it

### Why This Change?
The automatic scroll was annoying and made users lose control of WhatsApp.
Now:
- **Quick scan**: Instant, shows visible media only
- **Full scan**: Manual, only when you want it

### New Features
- "Full Scan (scroll history)" button in Advanced Options
- Warning message when using Full Scan
- Better status messages: "Found X files (visible)" vs "Full scan complete: X files found"

## [1.5.2] - 2025-12-20

### Fixed
- **Critical fix**: Improved chat container detection with two-strategy approach
- Now searches for scrollable elements instead of relying on specific selectors
- Strategy 1: Try known selectors and verify they are scrollable
- Strategy 2: Search all elements in #main for scrollable containers
- Should now find all 6 images instead of just the 4 visible ones
- Fixed conversation name detection removing tooltip text ("haz clic aquí para...")

### Technical
- Enhanced `scrollAndScan()` to intelligently find scrollable elements
- Checks `scrollHeight > clientHeight` to verify element is scrollable
- Falls back to searching all elements in `#main` if selectors fail
- Added filters to exclude tooltip/accessibility text from conversation names

## [1.5.1] - 2025-12-20

### Fixed
- **Critical bug fix**: Chat container selector was failing, preventing scroll and full conversation scan
- Added multiple fallback selectors for chat container to handle WhatsApp Web updates
- Enhanced logging to diagnose scroll issues
- Now properly finds all media in conversation (not just visible items)

### Technical
- Improved `scrollAndScan()` to try multiple selectors:
  - `[data-testid="conversation-panel-body"]`
  - `#main [role="application"]`
  - `#main div[tabindex="-1"][data-tab]`
  - And other fallbacks
- Added detailed logging for troubleshooting

## [1.5.0] - 2025-12-20

### Changed
- **Simplified for public release**: Removed time-based filtering completely
- Extension now always scans **all messages** in conversation (no time restrictions)
- Cleaner UI without confusing time range options
- Focus on reliability: scan everything, every time
- **Folder naming improved**: Downloads now saved to folders with date/time stamp
  - Format: `ContactName_YYYY_MM_DD_HH_MM`
  - Example: `Hijo_1_2025_12_20_14_30`
  - Makes it easy to organize multiple downloads from same contact

### Removed
- Time range selector (1h, 1.5h, 3h, 6h, 12h, 24h options)
- Time-based filtering logic (was unreliable due to WhatsApp changes)
- "Last X hours" display from summary

### Improved
- More predictable behavior - always scans full conversation
- Simplified Advanced Options - only media type selection remains
- Better user experience with consistent results
- Better folder organization with timestamps

### Technical
- Set `timeRangeHours = null` permanently
- Removed time filter UI elements
- Always uses full scan (`scrollAndScan()` instead of `scrollRecentMessages()`)
- Modified `sanitizeFolderName()` to append current date/time to folder names

## [1.4.1] - 2025-12-20

### Changed
- Improved timestamp detection for more reliable time-based filtering
- Enhanced auto-scan performance

### Known Issues
- Time-based filtering may not work reliably due to WhatsApp Web's changing structure
- **Recommended**: Use "All messages" option for best results

## [1.4.0] - 2025-12-20

### Added
- Advanced search algorithm for timestamp detection
- Better handling of WhatsApp Web's dynamic content

### Fixed
- Improved scanning reliability across different conversation types

## [1.3.0 - 1.3.3] - 2025-12-19

### Added
- Real date/time filtering for media
- Automatic rescan when switching conversations
- Improved folder naming (cleaner, without status text)
- "Buy Me a Coffee" support link

### Fixed
- More accurate time range filtering
- Better conversation name detection
- Cleaner folder organization

### Known Issues
- WhatsApp Web structure changes affecting timestamp detection
- Temporary workaround: "All messages" is now default

## [1.2.0] - 2025-12-19

### Added
- **Auto-scan feature** - Automatically scans when panel opens
- **Time range selector** - Choose 1h, 1.5h, 3h, 6h, 12h, 24h, or all messages
- **Advanced options** - Collapsible panel with media type and time filters
- **Smart summary** - Visual display of found media with counts

### Changed
- Simplified main interface
- One-click download workflow
- Faster scanning for recent messages
- UI redesign with modern summary cards

### Improved
- Better user experience (fewer clicks)
- Optimized performance for recent messages
- Cleaner interface with collapsible options

## [1.1.0] - 2025-12-19

### Added
- **Automatic folder organization** by conversation name
- Downloads saved in `whatsapp/[contact_name]/` structure

### Improved
- Better conversation name detection
- Handles special characters and emojis
- Fallback to phone number if name unavailable

## [1.0.0] - 2025-12-19

### Initial Release
- Bulk download images from WhatsApp Web
- Bulk download documents from WhatsApp Web
- Floating button UI
- Progress tracking
- Manual scan with full conversation scrolling
- English interface

---

## Upgrade Notes

### From any version to 1.4.x
- No action required
- Extension will work automatically
- Consider using "All messages" if time filtering doesn't work

### From 1.0.x to 1.2.x+
- Downloads now organized in conversation folders
- Auto-scan activates by default
- All previous features still available in Advanced Options

---

**Note**: This extension is not affiliated with WhatsApp or Meta Platforms, Inc.


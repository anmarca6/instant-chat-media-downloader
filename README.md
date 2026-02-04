# 📥 Instant Chat Media Downloader

Bulk download images and files from WhatsApp Web chats in one click.

![Version](https://img.shields.io/badge/version-1.9.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Chrome](https://img.shields.io/badge/chrome-compatible-brightgreen)

## ✨ Features

- ✨ **Magic Scan** - One-click scanning of visible messages (instant and reliable)
- ⏹️ **Stoppable Full Scan** - Search entire history with STOP control
- 📥 **One-click bulk download** - Download all media with a single click
- 📁 **Auto-organized folders** - Files saved in `Downloads/whatsapp/[contact_name]_[datetime]/`
- ⚙️ **Advanced options** - Filter by media type and full conversation scan
- 🎨 **Clean interface** - Seamlessly integrated with WhatsApp Web design
- 🔒 **100% private** - All processing happens locally, no data sent anywhere
- 🎯 **User control** - You decide when to scan and when to stop

## 🚀 How to Use

1. **Open a conversation** in WhatsApp Web
2. **Click the floating button** 📥 (top right corner)
3. **Click "✨ Magic Scan"** - Scans visible messages instantly
4. **Review detected files** - See count of images and documents
5. **(Optional)** Use "Full Scan" in Advanced Options for complete history (with STOP control)
6. **(Optional)** Adjust media types (images, documents, or both)
7. **Click "Download All"** - Files saved to `Downloads/whatsapp/[contact]_[datetime]/`

💡 **Tip for print shops:** Magic Scan is perfect for recent files. Use Full Scan only when you need older history.

That's it! Your files are automatically organized by conversation and timestamp.

**Example folder structure:**
```
Downloads/
  └── whatsapp/
      ├── Maria_20251220_14h30m15s/
      │   ├── image_001.jpg
      │   └── document_002.pdf
      └── John_20251220_15h45m30s/
          └── image_001.jpg
```

## ⚙️ Advanced Options

Click "⚙️ Advanced Options" to customize:

- **Media types**: Select images, documents, or both
- **Full Scan**: Scroll through entire conversation history to find all media
  - Magic Scan only detects visible messages (fast)
  - Use "Full Scan" to automatically scroll through complete conversation history
  - **⏹️ STOP button**: Click anytime to stop scanning when you have enough files
  - Perfect for long conversations where you don't need everything

## 🔒 Privacy & Security

- ✅ **100% local processing** - No external servers
- ✅ **No data collection** - Zero analytics or tracking
- ✅ **No message access** - Only detects media files
- ✅ **Open source** - Full code transparency
- ✅ **Secure permissions** - Only requests what's needed

## 📋 Permissions

This extension requires:

- **downloads**: To save files to your computer
- **storage**: To remember your preferences
- **activeTab**: To interact with the current tab
- **web.whatsapp.com**: To work with WhatsApp Web

All permissions are used solely for the extension's functionality.

## ⚠️ Known Limitations

- Video and audio downloads are not yet supported
- Large conversations may take longer to scan (extension will scroll through entire chat)
- Very old messages may require manual scrolling to load before scanning

## 🐛 Troubleshooting

### Extension doesn't appear
- Verify you're on `web.whatsapp.com`
- Refresh the page (Ctrl+F5 / Cmd+Shift+R)
- Check extension is enabled in `chrome://extensions/`

### Not detecting all files
- Wait for scan to complete (may take time for large conversations)
- Extension scans all visible messages automatically
- Some very old messages may require manual scrolling first

### Downloads fail
- Check Chrome download permissions
- Verify you have disk space
- Ensure stable internet connection
- Configure Chrome to allow multiple downloads from `web.whatsapp.com`

## ⚖️ Disclaimer

This extension is **not affiliated with WhatsApp or Meta Platforms, Inc.**

Use at your own risk. The developers are not responsible for:
- Account restrictions
- Data loss
- Violation of WhatsApp's Terms of Service

**Please use responsibly and respect WhatsApp's terms.**

## 💬 Support

- 🐛 Found a bug? Report it through Chrome Web Store support
- 💡 Feature request? We'd love to hear your ideas!
- ☕ Enjoy the extension? [Buy Me a Coffee](https://buymeacoffee.com/anmarca)

## 📄 License

MIT License - See LICENSE file for details

---

Made with 💚 for the community


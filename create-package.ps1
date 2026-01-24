# Chrome Web Store Package Creator
# Run this script to create a ZIP package ready for Chrome Web Store submission

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Chrome Web Store Package Creator" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Package name
$packageName = "instant-chat-media-downloader-v1.9.0.zip"

# Files and folders to include
$itemsToInclude = @(
    "manifest.json",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "icons",
    "src"
)

# Remove old package if exists
if (Test-Path $packageName) {
    Write-Host "Removing old package..." -ForegroundColor Yellow
    Remove-Item $packageName -Force
}

# Create ZIP package
Write-Host "Creating package: $packageName" -ForegroundColor Green
Write-Host ""

try {
    # Create ZIP
    Compress-Archive -Path $itemsToInclude -DestinationPath $packageName -Force
    
    Write-Host "✅ Package created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Package location: $(Get-Location)\$packageName" -ForegroundColor Cyan
    Write-Host ""
    
    # Show package info
    $zipFile = Get-Item $packageName
    Write-Host "Package size: $([math]::Round($zipFile.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "1. Go to https://chrome.google.com/webstore/devconsole" -ForegroundColor White
    Write-Host "2. Click 'New Item'" -ForegroundColor White
    Write-Host "3. Upload: $packageName" -ForegroundColor Yellow
    Write-Host "4. Fill in the store listing information" -ForegroundColor White
    Write-Host ""
    Write-Host "See CHROME_WEB_STORE_GUIDE.md for detailed instructions" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "❌ Error creating package: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


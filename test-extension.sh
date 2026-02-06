#!/bin/bash
# Chrome Extension Testing Script
# This script helps load and test the BrowserCopilot extension in Chrome

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
CHROME_EXTENSIONS_DIR="${HOME}/Library/Application Support/Google/Chrome/Default/Extensions"
EXTENSION_ID="browser-copilot-$(date +%s)"

echo "============================================"
echo "BrowserCopilot Extension Testing Script"
echo "============================================"

# Check if extension is built
if [ ! -d "${DIST_DIR}" ]; then
  echo "Extension not built. Building now..."
  npm run build
fi

# Detect Chrome profile
CHROME_PROFILE=""
if [ -d "${HOME}/Library/Application Support/Google/Chrome" ]; then
  CHROME_PROFILE="${HOME}/Library/Application Support/Google/Chrome/Default"
elif [ -d "${HOME}/.config/google-chrome" ]; then
  CHROME_PROFILE="${HOME}/.config/google-chrome/Default"
else
  echo "Warning: Chrome profile not found"
fi

echo ""
echo "Options:"
echo "1) Load extension in Chrome (development mode)"
echo "2) Run Playwright e2e tests"
echo "3) Run unit tests"
echo "4) Build extension"
echo "5) Open extension popup demo"
echo "6) Exit"
echo ""

read -p "Select an option (1-6): " option

case $option in
  1)
    echo ""
    echo "Loading extension in Chrome..."

    # Create a temporary directory for the extension
    TEMP_DIR=$(mktemp -d)
    cp -r "${DIST_DIR}"/* "${TEMP_DIR}/"

    # Add extension ID to manifest if needed for development
    if [ -f "${TEMP_DIR}/manifest.json" ]; then
      # Update manifest for development if key is not set
      if ! grep -q '"key"' "${TEMP_DIR}/manifest.json"; then
        echo "Note: Extension will get a new ID each time in development mode"
      fi
    fi

    # Open Chrome with the extension loaded
    if [ -n "$CHROME_PROFILE" ]; then
      open -a "Google Chrome" --args \
        --load-extension="${TEMP_DIR}" \
        --disable-extensions-except="${TEMP_DIR}" \
        --no-first-run \
        "chrome://extensions/"
      echo ""
      echo "Extension loaded in Chrome!"
      echo "Pin the extension to see the BrowserCopilot icon"
      echo "Temporary extension directory: ${TEMP_DIR}"
      echo ""
      echo "Note: This temporary extension will be deleted when Chrome closes."
    else
      echo "Could not find Chrome profile. Please load extension manually:"
      echo "1. Open chrome://extensions/"
      echo "2. Enable 'Developer mode'"
      echo "3. Click 'Load unpacked'"
      echo "4. Select: ${DIST_DIR}"
    fi
    ;;

  2)
    echo ""
    echo "Running Playwright e2e tests..."
    npm run test:e2e
    ;;

  3)
    echo ""
    echo "Running unit tests..."
    npm run test
    ;;

  4)
    echo ""
    echo "Building extension..."
    npm run build
    echo ""
    echo "Extension built in: ${DIST_DIR}"
    ;;

  5)
    echo ""
    echo "Opening sidepanel demo in browser..."

    # Start preview server in background
    npm run preview &
    PREVIEW_PID=$!

    sleep 3

    # Open the preview URL
    if command -v xdg-open &> /dev/null; then
      xdg-open "http://localhost:4173"
    elif command -v open &> /dev/null; then
      open "http://localhost:4173"
    fi

    echo "Demo opened at http://localhost:4173"
    echo "Press Ctrl+C to stop the preview server"
    wait $PREVIEW_PID
    ;;

  6)
    echo "Exiting..."
    exit 0
    ;;

  *)
    echo "Invalid option. Please select 1-6."
    exit 1
    ;;
esac

#!/bin/bash
# =============================================================
# VIOLET BITES - NEW LAPTOP QUICK SETUP SCRIPT
# Run this on a new laptop after cloning all 3 repos
# =============================================================

echo "=========================================="
echo "  VIOLET BITES - Quick Setup"
echo "=========================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo "[OK] Node.js $(node --version)"

# Check npm
echo "[OK] npm $(npm --version)"

# Setup canteen2.0 (Owner/Admin Web + Backend)
echo ""
echo ">>> Setting up canteen2.0..."
if [ -d "../canteen2.0-main/canteen2.0-main" ]; then
    cd ../canteen2.0-main/canteen2.0-main
    npm install
    echo "[OK] canteen2.0 dependencies installed"
    cd -
elif [ -d "../canteen2.0" ]; then
    cd ../canteen2.0
    npm install
    echo "[OK] canteen2.0 dependencies installed"
    cd -
else
    echo "[SKIP] canteen2.0 not found, clone it first"
fi

# Setup Canteen-App (Mobile)
echo ""
echo ">>> Setting up Canteen-App..."
if [ -d "../Canteen-App" ]; then
    cd ../Canteen-App
    npm install
    echo "[OK] Canteen-App dependencies installed"
    cd -
else
    echo "[SKIP] Canteen-App not found, clone it first"
fi

# Setup canteen-superadmin
echo ""
echo ">>> Setting up canteen-superadmin..."
if [ -d "../canteen-superadmin" ]; then
    cd ../canteen-superadmin
    npm install
    echo "[OK] canteen-superadmin dependencies installed"
    cd -
else
    echo "[SKIP] canteen-superadmin not found, clone it first"
fi

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "To run locally:"
echo "  cd canteen2.0 && npm run dev"
echo ""
echo "To build mobile APK:"
echo "  cd Canteen-App && npx expo prebuild --platform android"
echo "  cd Canteen-App/android && ./gradlew assembleRelease"
echo ""
echo "To deploy to Vercel:"
echo "  Push to GitHub -> Vercel auto-deploys"
echo "=========================================="

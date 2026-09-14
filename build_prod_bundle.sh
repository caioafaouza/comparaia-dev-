#!/bin/bash

echo "📦 Building Production Bundle..."

rm -rf dist-prod
mkdir -p dist-prod/server

# Copy Server Files
echo "Copying server files..."
rsync -av --exclude 'node_modules' --exclude 'logs' --exclude 'test-results' --exclude '.git' --exclude '.env' server/ dist-prod/server/

# Copy Root Configs
cp package.json dist-prod/
cp package-lock.json dist-prod/
cp ecosystem.config.cjs dist-prod/server/

# Copy Frontend Build (Assuming it is in dist/)
if [ -d "dist" ]; then
    echo "Copying frontend build..."
    cp -r dist dist-prod/
else
    echo "⚠️  WARN: dist folder not found. Make sure validation is run locally or remove this warning if API-only."
fi

# Create Archive
echo "Compressing..."
tar -czf production-bundle.tar.gz dist-prod

echo "✅ Bundle created: production-bundle.tar.gz"
echo "Instructions:"
echo "1. Upload production-bundle.tar.gz to VPS /www/wwwroot/ComparaIA"
echo "2. Extract: tar -xzf production-bundle.tar.gz"
echo "3. Move content: cp -r dist-prod/* ."
echo "4. Install deps: npm install --production --workspace server"
echo "5. Start: pm2 start server/ecosystem.config.cjs"

#!/bin/bash
set -euo pipefail

# Unpack Release on Server
# Extracts tarball, installs deps, and prepares for PM2 start

RELEASE_FILE="${1:?Usage: $0 <release-file.tar.gz>}"
DEPLOY_DIR="${2:-/var/www/comparaia}"

echo "=== Unpacking Release ==="
echo "Release: $RELEASE_FILE"
echo "Target: $DEPLOY_DIR"

# Extract
TEMP_DIR=$(mktemp -d)
echo "Extracting to $TEMP_DIR..."
tar -xzf "$RELEASE_FILE" -C "$TEMP_DIR"

# Find extracted directory
EXTRACTED=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "comparaia-release-*" | head -n 1)
if [ -z "$EXTRACTED" ]; then
    echo "ERROR: Could not find extracted directory"
    exit 1
fi

echo "Extracted: $EXTRACTED"

# Backup existing deployment
if [ -d "$DEPLOY_DIR" ]; then
    BACKUP_DIR="${DEPLOY_DIR}.backup.$(date +%Y%m%d%H%M%S)"
    echo "Backing up existing deployment to $BACKUP_DIR..."
    mv "$DEPLOY_DIR" "$BACKUP_DIR"
fi

# Move to deployment directory
echo "Moving to $DEPLOY_DIR..."
mkdir -p "$(dirname "$DEPLOY_DIR")"
mv "$EXTRACTED" "$DEPLOY_DIR"

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$DEPLOY_DIR"
bash deploy/scripts/02_install_backend.sh

# Create logs directory
mkdir -p "$DEPLOY_DIR/server/logs"

# Set permissions
echo "Setting permissions..."
chown -R www-data:www-data "$DEPLOY_DIR" || chown -R $USER:$USER "$DEPLOY_DIR"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Release unpacked to $DEPLOY_DIR"
echo ""
echo "Next steps:"
echo "  1. Copy .env files to server/ directory"
echo "  2. Run migrations: cd $DEPLOY_DIR && bash deploy/scripts/03_migrate_master.sh"
echo "  3. Start PM2: cd $DEPLOY_DIR && bash deploy/scripts/04_pm2_start.sh"
echo ""
echo "=== Unpack Complete ==="

#!/bin/bash
set -euo pipefail

# Pack Release for VPS Deployment
# Creates a .tar.gz with necessary files (excludes node_modules, logs, etc)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RELEASE_VERSION="${1:-$(date +%Y%m%d%H%M%S)}"
RELEASE_NAME="comparaia-release-$RELEASE_VERSION"
RELEASE_FILE="$PROJECT_ROOT/$RELEASE_NAME.tar.gz"

echo "=== Packing Release ==="
echo "Version: $RELEASE_VERSION"
echo "Output: $RELEASE_FILE"

cd "$PROJECT_ROOT"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
PACK_DIR="$TEMP_DIR/$RELEASE_NAME"
mkdir -p "$PACK_DIR"

echo "Copying files to $PACK_DIR..."

# Copy necessary directories and files
cp -r server "$PACK_DIR/" || true
cp -r deploy "$PACK_DIR/" || true
cp -r client/dist "$PACK_DIR/dist" 2>/dev/null || cp -r client/build "$PACK_DIR/dist" 2>/dev/null || echo "No frontend build found"
cp ecosystem.config.cjs "$PACK_DIR/" || true
cp package.json "$PACK_DIR/" || true
cp package-lock.json "$PACK_DIR/" || true

# Clean up unwanted files
echo "Cleaning up..."
find "$PACK_DIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "$PACK_DIR" -name "logs" -type d -exec rm -rf {} + 2>/dev/null || true
find "$PACK_DIR" -name "test-results" -type d -exec rm -rf {} + 2>/dev/null || true
find "$PACK_DIR" -name ".env" -type f -delete 2>/dev/null || true
find "$PACK_DIR" -name ".env.*" -type f -delete 2>/dev/null || true

# Create tarball
echo "Creating tarball..."
cd "$TEMP_DIR"
tar -czf "$RELEASE_FILE" "$RELEASE_NAME"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Release packed: $RELEASE_FILE"
echo "Size: $(du -sh "$RELEASE_FILE" | cut -f1)"
echo ""
echo "Upload to server with:"
echo "  scp $RELEASE_FILE user@server:/tmp/"
echo ""
echo "=== Pack Complete ==="

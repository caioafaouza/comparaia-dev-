#!/bin/bash
set -euo pipefail

# Install Backend Dependencies (production only)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Installing Backend Dependencies ==="
echo "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Root dependencies (if package.json exists)
if [ -f "package.json" ]; then
    echo "Installing root dependencies..."
    npm ci --omit=dev
fi

# Server dependencies
if [ -d "server" ] && [ -f "server/package.json" ]; then
    echo "Installing server dependencies..."
    cd server
    npm ci --omit=dev
    cd ..
fi

echo "✅ Backend dependencies installed"
echo "=== Backend Install Complete ==="

#!/bin/bash
set -euo pipefail

# Build Frontend (Vite or CRA)
# Detects client/ directory and builds accordingly

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Building Frontend ==="
echo "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

if [ -d "client" ]; then
    echo "Frontend directory: client/"
    cd client
    
    echo "Installing dependencies..."
    npm ci
    
    echo "Building..."
    npm run build
    
    # Detect build output
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    else
        echo "ERROR: No dist/ or build/ directory found after build"
        exit 1
    fi
    
    echo "✅ Frontend built: client/$BUILD_DIR"
else
    echo "No client/ directory found. Skipping frontend build."
fi

echo "=== Frontend Build Complete ==="

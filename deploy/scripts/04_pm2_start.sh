#!/bin/bash
set -euo pipefail

# Start PM2 processes
# Requires: PM2 installed globally (npm install -g pm2)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Starting PM2 Processes ==="
echo "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Create logs directory
mkdir -p server/logs

# Stop existing processes (if any)
echo "Stopping existing PM2 processes..."
pm2 delete all || true

# Start with ecosystem config
echo "Starting processes from ecosystem.config.cjs..."
pm2 start ecosystem.config.cjs --env production

# Save PM2 config
echo "Saving PM2 configuration..."
pm2 save

# Status
pm2 status

echo ""
echo "✅ PM2 processes started"
echo ""
echo "IMPORTANT: Run 'pm2 startup' to enable auto-start on boot"
echo "Follow the command output and run the generated sudo command"
echo ""
echo "=== PM2 Start Complete ==="

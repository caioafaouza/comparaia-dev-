#!/bin/bash
set -euo pipefail

# Health Check for Compara IA
# Verifies API port, health endpoint, and PM2 status

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

API_PORT=3000
API_URL="http://127.0.0.1:$API_PORT/api/health"

echo "=== Compara IA Health Check ==="
echo "Timestamp: $(date)"
echo ""

# Check port
echo "[1/3] Checking port $API_PORT..."
if nc -z 127.0.0.1 $API_PORT 2>/dev/null; then
    echo "✅ Port $API_PORT is open"
else
    echo "❌ Port $API_PORT is NOT reachable"
fi
echo ""

# Check health endpoint
echo "[2/3] Checking API health endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $API_URL || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API health check passed (HTTP $HTTP_CODE)"
    RESPONSE=$(curl -s $API_URL)
    echo "Response: $RESPONSE"
else
    echo "❌ API health check failed (HTTP $HTTP_CODE)"
fi
echo ""

# PM2 status
echo "[3/3] PM2 Status:"
pm2 status
echo ""

# Recent logs
echo "=== Recent API Logs (last 50 lines) ==="
tail -n 50 "$PROJECT_ROOT/server/logs/api-out.log" 2>/dev/null || echo "No logs found"
echo ""

echo "=== Health Check Complete ==="

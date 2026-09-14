#!/bin/bash
set -euo pipefail

# Apply Redis ACL Configuration
# Requires REDIS_ADMIN_PASSWORD environment variable

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Applying Redis ACL ==="

# Check for admin password
if [ -z "${REDIS_ADMIN_PASSWORD:-}" ]; then
    echo "ERROR: REDIS_ADMIN_PASSWORD environment variable is required"
    echo ""
    echo "Usage:"
    echo "  REDIS_ADMIN_PASSWORD='your_password' bash $0"
    echo ""
    exit 1
fi

cd "$PROJECT_ROOT/server"

# Run ACL script
echo "Running apply_redis_acl.js..."
node scripts/apply_redis_acl.js

echo ""
echo "✅ Redis ACL applied"
echo ""
echo "Credentials updated in server/.env"
echo "Review server/test-results/redis_acl_output.txt for details"
echo ""
echo "=== ACL Apply Complete ==="

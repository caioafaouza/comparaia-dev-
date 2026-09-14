#!/bin/bash
set -euo pipefail

# Run Master Schema Migrations
# CAUTION: This modifies the database. Review migrations before running.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Running Master Schema Migrations ==="
echo "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT/server"

# Check if migrate:master script exists
if ! npm run | grep -q "migrate:master"; then
    echo "No migrate:master script found in package.json"
    echo "Skipping migrations."
    exit 0
fi

echo "Running migrations..."
npm run migrate:master

echo "✅ Migrations completed"
echo "=== Migration Complete ==="

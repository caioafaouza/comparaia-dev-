#!/bin/bash
set -euo pipefail

# Production Deployment Package Builder for aaPanel
# Creates a deployment-ready package for VPS with PM2/aaPanel
# Usage: ./prepare_prod_aapanel.sh <APP_NAME> [--with-tests] [--frontend-path <path>]

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M)
APP_NAME=""
INCLUDE_TESTS=false
FRONTEND_PATH=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Functions
# ============================================================================

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

usage() {
    cat <<EOF
Usage: $0 <APP_NAME> [OPTIONS]

Required:
  APP_NAME              Application name (e.g., comparaia)

Options:
  --with-tests          Include server/tests/ and all scripts
  --no-tests            Include only essential scripts (default)
  --frontend-path PATH  Force frontend build path

Examples:
  $0 comparaia
  $0 comparaia --with-tests
  $0 comparaia --frontend-path client/dist
EOF
    exit 1
}

detect_hash_cmd() {
    if command -v sha256sum &>/dev/null; then
        echo "sha256sum"
    elif command -v shasum &>/dev/null; then
        echo "shasum -a 256"
    else
        warn "No SHA256 command found. Hashes will be skipped."
        echo ""
    fi
}

detect_frontend_build() {
    local paths=(
        "dist"
        "client/dist"
        "client/build"
        "frontend/dist"
        "frontend/build"
    )
    
    for path in "${paths[@]}"; do
        if [ -d "$SCRIPT_DIR/$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    return 1
}

detect_lockfile() {
    if [ -f "$SCRIPT_DIR/package-lock.json" ]; then
        echo "package-lock.json"
    elif [ -f "$SCRIPT_DIR/pnpm-lock.yaml" ]; then
        echo "pnpm-lock.yaml"
    elif [ -f "$SCRIPT_DIR/yarn.lock" ]; then
        echo "yarn.lock"
    else
        echo ""
    fi
}

create_env_example() {
    local target="$1"
    
    if [ -f "$target" ]; then
        log "File $target already exists, skipping"
        return
    fi
    
    log "Creating $target"
    cat > "$target" <<'EOF'
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=your_redis_user
REDIS_PASSWORD=your_redis_password

# Security
JWT_SECRET=your_jwt_secret_min_32_chars
KEY_ENCRYPTION_SECRET=your_64_hex_chars_encryption_key

# MinIO/S3
MINIO_ENDPOINT=s3.example.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET=your_bucket_name

# Application
CORS_ORIGINS=https://your-domain.com
LOG_LEVEL=info
MASTER_ADMIN_EMAIL=admin@example.com
MASTER_ADMIN_PASSWORD=your_admin_password

# Feature Flags
PUBSUB_GATE_STRICT=false
ENABLE_MOCK_AI=false

# URLs
BASE_URL=https://your-domain.com
API_URL=https://your-domain.com/api
EOF
}

create_readme_deploy() {
    local output_dir="$1"
    local app_name="$2"
    
    log "Creating README_DEPLOY.md"
    cat > "$output_dir/README_DEPLOY.md" <<EOF
# Deployment Guide for ${app_name}

## Prerequisites

- aaPanel installed on Ubuntu VPS
- Node.js v24.x installed
- PM2 installed globally: \`npm install -g pm2\`
- PostgreSQL database created
- Redis server running
- Domain configured in aaPanel

## Deployment Steps

### 1. Upload Files to VPS

Upload this entire directory to:
\`\`\`
/www/wwwroot/${app_name}/
\`\`\`

### 2. Install Dependencies

\`\`\`bash
cd /www/wwwroot/${app_name}
npm ci --omit=dev

cd server
npm ci --omit=dev
\`\`\`

### 3. Configure Environment

\`\`\`bash
# Copy and edit environment file
cp server/.env.example server/.env
nano server/.env  # Fill in real credentials
\`\`\`

### 4. Run Database Migrations

\`\`\`bash
cd /www/wwwroot/${app_name}/server
npm run migrate:master
\`\`\`

### 5. Start PM2

\`\`\`bash
cd /www/wwwroot/${app_name}
pm2 start ecosystem.config.cjs --env production

# Save PM2 config
pm2 save

# Enable auto-start on boot
pm2 startup
# Follow the generated command
\`\`\`

### 6. Configure Nginx in aaPanel

1. Open aaPanel → Website
2. Add site for your domain
3. Edit site configuration to proxy /api to http://127.0.0.1:3000
4. Point root to \`/www/wwwroot/${app_name}/dist\`

### 7. Verify Deployment

\`\`\`bash
# Check PM2 status
pm2 status

# Test API
curl http://localhost:3000/api/health

# Check logs
pm2 logs

# View specific app logs
tail -f server/logs/api-out.log
\`\`\`

## Health Check

\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

Expected response: HTTP 200 with JSON status

## Common Issues

### PM2 Not Starting
- Check environment variables in server/.env
- Verify database connectivity
- Check logs: \`pm2 logs\`

### Database Connection Error
- Verify DB credentials in server/.env
- Check PostgreSQL is running: \`systemctl status postgresql\`
- Test connection: \`psql -h localhost -U <user> -d <database>\`

### Redis Connection Error
- Check Redis is running: \`redis-cli ping\`
- Verify REDIS_HOST and REDIS_PORT in server/.env

## Maintenance

### Update Deployment
1. Upload new package
2. \`pm2 reload all\` (zero-downtime restart)

### View Logs
\`\`\`bash
pm2 logs           # All apps
pm2 logs compara-api      # API only
pm2 logs compara-processor  # Processor only
\`\`\`

### Restart Services
\`\`\`bash
pm2 restart all
pm2 restart compara-api
\`\`\`

### Backup Database
\`\`\`bash
pg_dump -h localhost -U <user> <database> > backup_\$(date +%Y%m%d).sql
\`\`\`

## Security Notes

- Never commit .env files
- Use strong passwords for all services
- Rotate KEY_ENCRYPTION_SECRET periodically
- Keep Redis password separate from DB password
- Enable firewall (ufw) and only allow necessary ports

## Support

Check DEPLOY_MANIFEST.json for package details and file hashes.
EOF
}

create_manifest() {
    local output_dir="$1"
    local total_size="$2"
    local hash_cmd="$3"
    
    log "Creating DEPLOY_MANIFEST.json"
    
    local manifest_file="$output_dir/DEPLOY_MANIFEST.json"
    
    # Get file hashes if hash command exists
    local ecosystem_hash=""
    local server_index_hash=""
    
    if [ -n "$hash_cmd" ]; then
        if [ -f "$output_dir/ecosystem.config.cjs" ]; then
            ecosystem_hash=$($hash_cmd "$output_dir/ecosystem.config.cjs" | awk '{print $1}')
        fi
        
        if [ -f "$output_dir/server/index.js" ]; then
            server_index_hash=$($hash_cmd "$output_dir/server/index.js" | awk '{print $1}')
        fi
    fi
    
    # Count files
    local file_count=$(find "$output_dir" -type f | wc -l)
    
    # Create JSON
    cat > "$manifest_file" <<EOF
{
  "app_name": "$APP_NAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "package_info": {
    "total_size": "$total_size",
    "file_count": $file_count,
    "includes_tests": $INCLUDE_TESTS
  },
  "file_hashes": {
    "ecosystem.config.cjs": "$ecosystem_hash",
    "server/index.js": "$server_index_hash"
  },
  "deployment_target": "aaPanel/PM2",
  "deployment_path": "/www/wwwroot/$APP_NAME/"
}
EOF
}

# ============================================================================
# Main Script
# ============================================================================

main() {
    log "Production Deployment Package Builder"
    log "======================================"
    echo ""
    
    # Parse arguments
    if [ $# -lt 1 ]; then
        usage
    fi
    
    APP_NAME="$1"
    shift
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --with-tests)
                INCLUDE_TESTS=true
                shift
                ;;
            --no-tests)
                INCLUDE_TESTS=false
                shift
                ;;
            --frontend-path)
                FRONTEND_PATH="$2"
                shift 2
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    log "App Name: $APP_NAME"
    log "Include Tests: $INCLUDE_TESTS"
    echo ""
    
    # Validate required directories
    if [ ! -d "$SCRIPT_DIR/server" ]; then
        error "server/ directory not found in $SCRIPT_DIR"
    fi
    
    # Detect frontend build
    if [ -n "$FRONTEND_PATH" ]; then
        if [ ! -d "$SCRIPT_DIR/$FRONTEND_PATH" ]; then
            error "Specified frontend path not found: $FRONTEND_PATH"
        fi
        log "Using frontend build: $FRONTEND_PATH"
    else
        FRONTEND_PATH=$(detect_frontend_build) || error "Frontend build not found. Use --frontend-path to specify."
        log "Detected frontend build: $FRONTEND_PATH"
    fi
    
    # Detect lockfile
    LOCKFILE=$(detect_lockfile)
    if [ -n "$LOCKFILE" ]; then
        log "Detected lockfile: $LOCKFILE"
    else
        warn "No lockfile found. Deployment may have dependency version issues."
    fi
    
    # Check ecosystem.config.cjs
    if [ ! -f "$SCRIPT_DIR/ecosystem.config.cjs" ]; then
        error "ecosystem.config.cjs not found. Please create it first or use the provided template."
    fi
    
    # Detect hash command
    HASH_CMD=$(detect_hash_cmd)
    
    # Create output directory
    OUTPUT_DIR="$SCRIPT_DIR/deploy_prod_${APP_NAME}_${TIMESTAMP}"
    log "Creating output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    
    # Copy essential files
    log "Copying project files..."
    
    # Copy server directory (excluding node_modules, logs, etc)
    log "  - server/"
    rsync -a --exclude='node_modules' \
             --exclude='logs' \
             --exclude='tmp' \
             --exclude='test-results' \
             --exclude='*.log' \
             --exclude='.DS_Store' \
             "$SCRIPT_DIR/server/" "$OUTPUT_DIR/server/"
    
    # Exclude tests if not needed
    if [ "$INCLUDE_TESTS" = false ]; then
        log "  - Excluding server/tests/ (use --with-tests to include)"
        rm -rf "$OUTPUT_DIR/server/tests"
    fi
    
    # Copy frontend build
    log "  - Frontend build from $FRONTEND_PATH"
    mkdir -p "$OUTPUT_DIR/dist"
    rsync -a "$SCRIPT_DIR/$FRONTEND_PATH/" "$OUTPUT_DIR/dist/"
    
    # Copy root files
    log "  - Root configuration files"
    [ -f "$SCRIPT_DIR/package.json" ] && cp "$SCRIPT_DIR/package.json" "$OUTPUT_DIR/"
    [ -f "$SCRIPT_DIR/ecosystem.config.cjs" ] && cp "$SCRIPT_DIR/ecosystem.config.cjs" "$OUTPUT_DIR/"
    
    # Copy lockfile if exists
    if [ -n "$LOCKFILE" ]; then
        log "  - $LOCKFILE"
        cp "$SCRIPT_DIR/$LOCKFILE" "$OUTPUT_DIR/"
    fi
    
    # Copy PROD_READY_REPORT.md if exists
    if [ -f "$SCRIPT_DIR/server/test-results/PROD_READY_REPORT.md" ]; then
        log "  - PROD_READY_REPORT.md"
        cp "$SCRIPT_DIR/server/test-results/PROD_READY_REPORT.md" "$OUTPUT_DIR/"
    fi
    
    # Create .env.example files
    log "Creating environment templates..."
    create_env_example "$OUTPUT_DIR/.env.example"
    create_env_example "$OUTPUT_DIR/server/.env.example"
    
    # Create deployment documentation
    create_readme_deploy "$OUTPUT_DIR" "$APP_NAME"
    
    # Calculate total size
    TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
    
    # Create manifest
    create_manifest "$OUTPUT_DIR" "$TOTAL_SIZE" "$HASH_CMD"
    
    # Final summary
    echo ""
    log "======================================"
    log "Package Created Successfully!"
    log "======================================"
    echo ""
    echo "📦 Package Location: $OUTPUT_DIR"
    echo "📊 Total Size: $TOTAL_SIZE"
    echo "📋 Files: $(find "$OUTPUT_DIR" -type f | wc -l)"
    echo ""
    
    # Deployment checklist
    log "Next Steps:"
    echo ""
    echo "1️⃣  Upload to VPS:"
    echo "   scp -r $OUTPUT_DIR user@your-vps:/tmp/"
    echo ""
    echo "   Or using rsync:"
    echo "   rsync -avz --progress $OUTPUT_DIR user@your-vps:/tmp/"
    echo ""
    echo "2️⃣  On the VPS:"
    echo "   sudo mv /tmp/$(basename $OUTPUT_DIR) /www/wwwroot/$APP_NAME"
    echo "   cd /www/wwwroot/$APP_NAME"
    echo ""
    echo "3️⃣  Install dependencies:"
    echo "   npm ci --omit=dev"
    echo "   cd server && npm ci --omit=dev && cd .."
    echo ""
    echo "4️⃣  Configure environment:"
    echo "   cp server/.env.example server/.env"
    echo "   nano server/.env  # Fill in credentials"
    echo ""
    echo "5️⃣  Run migrations:"
    echo "   cd server && npm run migrate:master && cd .."
    echo ""
    echo "6️⃣  Start PM2:"
    echo "   pm2 start ecosystem.config.cjs --env production"
    echo "   pm2 save"
    echo "   pm2 startup  # Follow instructions"
    echo ""
    echo "7️⃣  Health check:"
    echo "   curl http://localhost:3000/api/health"
    echo ""
    echo "📖 Full instructions: $OUTPUT_DIR/README_DEPLOY.md"
    echo "📋 Manifest: $OUTPUT_DIR/DEPLOY_MANIFEST.json"
    echo ""
}

# Run main
main "$@"

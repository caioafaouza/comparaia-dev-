# Production Deployment Package Builder

## Quick Start

### Make Script Executable

```bash
chmod +x prepare_prod_aapanel.sh
```

### Basic Usage

```bash
# Build package without tests (recommended for production)
./prepare_prod_aapanel.sh comparaia

# Build package with tests included (for staging/testing)
./prepare_prod_aapanel.sh comparaia --with-tests

# Specify custom frontend path
./prepare_prod_aapanel.sh comparaia --frontend-path client/dist
```

## What It Does

1. **Validates** project structure (server/, frontend build, ecosystem.config.cjs)
2. **Creates** timestamped deployment directory: `deploy_prod_<APP_NAME>_<YYYYMMDD_HHMM>/`
3. **Copies** essential files only:
   - `server/` (excluding node_modules, logs, tmp)
   - Frontend build (`dist/`, auto-detected)
   - `package.json`, lockfile, `ecosystem.config.cjs`
   - Optional: tests and scripts (with `--with-tests`)
4. **Generates** deployment documentation:
   - `README_DEPLOY.md` (step-by-step guide)
   - `.env.example` templates
   - `DEPLOY_MANIFEST.json` (package metadata with SHA256 hashes)
5. **Outputs** deployment commands for VPS

## Output Structure

```
deploy_prod_comparaia_20260203_1700/
├── server/
│   ├── index.js
│   ├── processorRunner.js
│   ├── scripts/
│   ├── services/
│   ├── db/
│   ├── .env.example
│   └── package.json
├── dist/                    # Frontend build
├── ecosystem.config.cjs
├── package.json
├── package-lock.json        # Or pnpm-lock.yaml / yarn.lock
├── README_DEPLOY.md
├── .env.example
└── DEPLOY_MANIFEST.json
```

## Uploading to VPS

### Option 1: SCP (Simple Copy)

```bash
# Upload entire directory
scp -r deploy_prod_comparaia_* user@your-vps:/tmp/

# Then on VPS
sudo mv /tmp/deploy_prod_comparaia_* /www/wwwroot/comparaia
```

### Option 2: Rsync (Resume Support)

```bash
# Upload with progress
rsync -avz --progress deploy_prod_comparaia_* user@your-vps:/tmp/

# Or exclude unnecessary files on the fly
rsync -avz --progress \
  --exclude='*.md' \
  --exclude='DEPLOY_MANIFEST.json' \
  deploy_prod_comparaia_* user@your-vps:/www/wwwroot/comparaia/
```

### Option 3: Tar + Upload (Smaller Transfer)

```bash
# Create compressed archive
tar -czf comparaia_prod.tar.gz deploy_prod_comparaia_*

# Upload
scp comparaia_prod.tar.gz user@your-vps:/tmp/

# Extract on VPS
ssh user@your-vps
cd /tmp
tar -xzf comparaia_prod.tar.gz
sudo mv deploy_prod_comparaia_* /www/wwwroot/comparaia
```

## On VPS (aaPanel)

### 1. Install Dependencies

```bash
cd /www/wwwroot/comparaia
npm ci --omit=dev

cd server
npm ci --omit=dev
cd ..
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
nano server/.env  # Fill in real credentials
```

### 3. Database Setup

```bash
cd server
npm run migrate:master
cd ..
```

### 4. Start with PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # Follow generated command
```

### 5. Configure Nginx (aaPanel)

In aaPanel web interface:

1. Website → Add Site
2. Domain: your-domain.com
3. Root: `/www/wwwroot/comparaia/dist`
4. Edit Nginx config to add API proxy:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### 6. Verify

```bash
curl http://localhost:3000/api/health
pm2 status
pm2 logs
```

## Troubleshooting

### Script Fails: "server/ directory not found"

- Run script from project root (where `server/` directory exists)

### Script Fails: "Frontend build not found"

- Build frontend first: `cd client && npm run build`
- Or specify path: `--frontend-path client/dist`

### Script Fails: "ecosystem.config.cjs not found"

- Use the provided `ecosystem.config.cjs` in `deploy/` directory
- Or copy to project root

### No lockfile warning

- Run `npm install` to generate `package-lock.json`
- Or use your existing package manager's lockfile

## Security Notes

- **Never commit** generated `.env` files
- **Rotate secrets** before each deployment
- **Use strong passwords** for all services
- **Review** `DEPLOY_MANIFEST.json` to verify file hashes

## Maintenance

### Update Deployment

```bash
# Build new package
./prepare_prod_aapanel.sh comparaia

# Upload and replace
rsync -avz --delete deploy_prod_comparaia_* user@vps:/www/wwwroot/comparaia/

# Reload PM2 (zero downtime)
pm2 reload all
```

### Rollback

```bash
# Keep previous deployment as backup
mv /www/wwwroot/comparaia /www/wwwroot/comparaia.backup
mv /www/wwwroot/comparaia.old /www/wwwroot/comparaia
pm2 restart all
```

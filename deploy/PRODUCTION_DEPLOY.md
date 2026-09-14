# Production Deployment Guide

## Prerequisites

- VPS with Ubuntu 20.04+ or similar
- Node.js v24.x installed
- PM2 installed globally: `npm install -g pm2`
- Nginx installed: `apt install nginx`
- PostgreSQL and Redis running
- Domain pointing to server IP

## Pre-Deployment Checklist

- [ ] Database created and accessible
- [ ] Redis running and accessible
- [ ] MinIO/S3 bucket created
- [ ] Domain DNS configured
- [ ] SSL certificate ready (or use certbot)
- [ ] Environment variables prepared
- [ ] Firewall configured (ports 22, 80, 443, 3000)

## Deployment Steps

### 1. Build and Pack Release (Local Machine)

```bash
# Build frontend
bash deploy/scripts/01_build_frontend.sh

# Pack release
bash deploy/scripts/06_pack_release.sh

# Output: comparaia-release-YYYYMMDDHHMMSS.tar.gz
```

### 2. Upload to Server

```bash
# Via SCP
scp comparaia-release-*.tar.gz user@server:/tmp/

# Or via rsync
rsync -avz comparaia-release-*.tar.gz user@server:/tmp/
```

### 3. Unpack on Server

```bash
# SSH into server
ssh user@server

# Unpack release
cd /tmp
sudo bash comparaia-release-*/deploy/scripts/07_unpack_release.sh \
  comparaia-release-*.tar.gz \
  /var/www/comparaia
```

### 4. Configure Environment

```bash
# Copy and edit server environment
cd /var/www/comparaia
sudo cp deploy/env/server.env.production.example server/.env
sudo nano server/.env  # Fill in real credentials

# Set proper ownership
sudo chown -R www-data:www-data /var/www/comparaia
```

### 5. Run Migrations

```bash
cd /var/www/comparaia
sudo -u www-data bash deploy/scripts/03_migrate_master.sh
```

### 6. Configure Nginx

```bash
# Copy config
sudo cp /var/www/comparaia/deploy/nginx/comparaia.http.conf \
  /etc/nginx/sites-available/comparaia

# Edit server name
sudo nano /etc/nginx/sites-available/comparaia

# Enable site
sudo ln -s /etc/nginx/sites-available/comparaia \
  /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 7. Setup SSL (Optional)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d comparaia.example.com

# Or use pre-configured HTTPS config
sudo cp /var/www/comparaia/deploy/nginx/comparaia.https.conf \
  /etc/nginx/sites-available/comparaia
# Edit and certbot will fill certificates
```

### 8. Start PM2

```bash
cd /var/www/comparaia
sudo -u www-data bash deploy/scripts/04_pm2_start.sh

# Enable PM2 startup on boot
pm2 startup
# Follow the generated command
pm2 save
```

### 9. Verify Deployment

```bash
bash deploy/scripts/05_healthcheck.sh
```

Expected output:

- Port 3000 open
- API health: HTTP 200
- PM2 status: Both apps online

### 10. Monitor Logs

```bash
# PM2 logs
pm2 logs

# Nginx access log
sudo tail -f /var/log/nginx/comparaia-access.log

# Application logs
tail -f /var/www/comparaia/server/logs/api-out.log
```

## Redis ACL Setup (Multi-Instance Only)

If deploying multiple instances, apply Redis ACL:

```bash
cd /var/www/comparaia
REDIS_ADMIN_PASSWORD='your_admin_pass' \
  bash deploy/scripts/08_apply_redis_acl.sh
```

Verify Pub/Sub:

```bash
cd /var/www/comparaia/server
PUBSUB_GATE_STRICT=true npm run test:pubsub
```

## Rollback Procedure

```bash
# Stop current version
pm2 delete all

# Restore backup
sudo mv /var/www/comparaia /var/www/comparaia.failed
sudo mv /var/www/comparaia.backup.TIMESTAMP /var/www/comparaia

# Restart PM2
cd /var/www/comparaia
sudo -u www-data bash deploy/scripts/04_pm2_start.sh
```

## Security Best Practices

1. **Environment Files**
   - Never commit `.env` files
   - Use strong, random passwords
   - Rotate `KEY_ENCRYPTION_SECRET` periodically
   - Keep Redis password separate from DB password

2. **File Permissions**
   - Config files: `600` (owner read/write only)
   - Logs directory: `755` (owner full, others read/execute)
   - Application files: owned by `www-data` or non-root user

3. **Firewall**

   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

4. **Database Access**
   - Use dedicated user for app
   - Restrict to localhost if possible
   - Enable SSL for remote connections

## Monitoring

### PM2 Monitoring

```bash
# Status
pm2 status

# Logs
pm2 logs --lines 100

# Restart specific app
pm2 restart compara-api
pm2 restart compara-processor

# Reload (zero-downtime)
pm2 reload compara-api
```

### Health Checks

```bash
# API endpoint
curl http://localhost:3000/api/health

# Full check
bash /var/www/comparaia/deploy/scripts/05_healthcheck.sh
```

### Disk Space

```bash
# Check logs size
du -sh /var/www/comparaia/server/logs/

# Rotate logs (PM2 handles this, but manual if needed)
pm2 install pm2-logrotate
```

## Troubleshooting

### API Not Starting

```bash
# Check PM2 error logs
pm2 logs compara-api --err --lines 50

# Check environment
pm2 env 0  # Where 0 is the app id

# Restart
pm2 restart compara-api
```

### Database Connection Errors

```bash
# Test connection
psql -h localhost -U comparaia -d comparaia

# Check .env file
cat /var/www/comparaia/server/.env | grep DB_
```

### Nginx 502 Bad Gateway

```bash
# Check if API is running
curl http://localhost:3000/api/health

# Check Nginx config
sudo nginx -t

# Check Nginx error log
sudo tail -f /var/log/nginx/comparaia-error.log
```

## Maintenance

### Update Deployment

```bash
# Build new release locally
bash deploy/scripts/06_pack_release.sh

# Upload and unpack on server
# Follow steps 2-8 above
```

### Database Backup

```bash
# Dump database
pg_dump -h localhost -U comparaia comparaia > backup.sql

# Restore
psql -h localhost -U comparaia comparaia < backup.sql
```

### Log Rotation

PM2 handles log rotation automatically. Manual rotation:

```bash
pm2 flush  # Clear all logs
```

## Production Gates (WARNING)

**DO NOT RUN** the following scripts in production:

- `npm run reset:full` (destroys data)
- `npm run test:prod-ready` (may reset database)

For validation, use:

- `npm run test:pubsub` (safe, read-only)
- `npm run test:ledger` (safe, isolated test)

#!/bin/bash

# Configuration
DB_NAME="comparaia"
DB_USER="comparaia_user"
BACKUP_DIR="/www/backup/database/comparaia"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="db_backup_${DATE}.sql.gz"

# Ensure backup dir exists
mkdir -p $BACKUP_DIR

# Dump
echo "started backup: $FILENAME"
pg_dump -U $DB_USER -h 127.0.0.1 $DB_NAME | gzip > "$BACKUP_DIR/$FILENAME"

# Retention (Keep last 7 days)
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +7 -delete

echo "finished backup: $FILENAME"

# aaPanel Cron Instruction:
# 0 3 * * * /www/wwwroot/ComparaIA/server/scripts/backup_db.sh >> /www/wwwroot/ComparaIA/server/logs/backup.log 2>&1

#!/bin/bash

# Usage: ./restore_db.sh <backup_file.sql.gz>

if [ -z "$1" ]; then
  echo "Usage: ./restore_db.sh <backup_file.sql.gz>"
  exit 1
fi

DB_NAME="comparaia"
DB_USER="comparaia_user"
FILE=$1

echo "⚠️  WARNING: This will OVERWRITE database $DB_NAME."
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo "Restoring from $FILE..."
gunzip -c $FILE | psql -U $DB_USER -h 127.0.0.1 $DB_NAME

echo "Restore completed."

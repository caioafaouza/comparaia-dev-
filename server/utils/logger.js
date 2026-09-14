const fs = require('fs');
const path = require('path');
const config = require('../config/env');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const APP_LOG = path.join(LOG_DIR, 'app.log');
const ERROR_LOG = path.join(LOG_DIR, 'error.log');

const levelOrder = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = (() => {
  const raw = (config.security.logLevel || 'info').toLowerCase();
  return levelOrder[raw] !== undefined ? raw : 'info';
})();

const ensureLogDir = () => {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // ignore
  }
};

const shouldLog = (level) => levelOrder[level] <= levelOrder[currentLevel];

const formatLine = (level, message, meta) => {
  const time = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${time} ${level.toUpperCase()} ${message}${suffix}\n`;
};

const writeLine = (filePath, line) => {
  try {
    fs.appendFileSync(filePath, line, 'utf8');
  } catch {
    // ignore
  }
};

const log = (level, message, meta, err) => {
  if (!shouldLog(level)) return;
  ensureLogDir();
  const line = formatLine(level, message, meta);
  if (level === 'error' || level === 'warn') {
    // keep stderr for error/warn
    // eslint-disable-next-line no-console
    console.error(message, meta || '');
  } else {
    // eslint-disable-next-line no-console
    console.log(message, meta || '');
  }
  writeLine(APP_LOG, line);
  if (err) {
    const stackLine = formatLine('error', message, {
      ...meta,
      stack: err.stack || String(err),
    });
    writeLine(ERROR_LOG, stackLine);
  }
};

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  error: (message, meta, err) => log('error', message, meta, err),
};

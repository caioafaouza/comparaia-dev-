// PM2 Ecosystem Configuration for Compara IA
// Usage: pm2 start ecosystem.config.cjs --env production

const path = require('path');

const playwrightBrowsersPath = path.join(__dirname, '.cache', 'ms-playwright');

module.exports = {
    apps: [
        {
            name: 'compara-api',
            script: './server/index.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_restarts: 10,
            restart_delay: 3000,
            min_uptime: '10s',
            kill_timeout: 5000,
            listen_timeout: 10000,
            wait_ready: true,
            shutdown_with_message: true,
            error_file: './server/logs/api-error.log',
            out_file: './server/logs/api-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true,
            // Production env is loaded from .env by server/config/env.js
            // Keep this minimal to avoid overriding secrets with placeholders.
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
                PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath
            }
        },
        {
            name: 'compara-processor',
            script: './server/processorRunner.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_restarts: 10,
            restart_delay: 5000,
            min_uptime: '15s',
            kill_timeout: 10000,
            error_file: './server/logs/processor-error.log',
            out_file: './server/logs/processor-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true,
            // Production env is loaded from .env by server/config/env.js
            env_production: {
                NODE_ENV: 'production',
                PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath
            }
        }
    ]
};

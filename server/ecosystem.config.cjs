module.exports = {
    apps: [
        {
            name: 'compara-api',
            script: './index.js',
            instances: 1, // API pode escalar se stateless, mas comece com 1 para evitar problemas de socket.io se houver
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        },
        {
            name: 'compara-processor',
            script: './processorRunner.js',
            instances: 1, // Processor deve ser unico por tenant ou global com lock. 1 é seguro.
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            restart_delay: 5000, // Aguarda DB subir se cair junto
            env_production: {
                NODE_ENV: 'production',
                JOB_POLL_MS: 3000
            }
        }
    ]
};

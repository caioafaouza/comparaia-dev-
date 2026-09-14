const { startTestServer } = require('./helpers/testServer');
const { loginMaster } = require('./helpers/authUtils');
const { truncateMasterTables } = require('./helpers/dbUtils');
// const { connectionManager } = require('../db/connectionManager');

describe('Admin Configuration & Infra', () => {
    let masterToken;

    beforeAll(async () => {
        const loginRes = await loginMaster();
        masterToken = loginRes.token;
    });

    beforeEach(async () => {
        // truncateMasterTables(); // Config tests might not need full truncate if they just read/update config table
    });

    describe('Global Config', () => {
        test('GET /api/admin/config should return default config', async () => {
            const res = await startTestServer()
                .get('/api/admin/config')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('appName');
            expect(res.body).toHaveProperty('activeAIProvider');
        });

        test('POST /api/admin/config should update config', async () => {
            const updates = {
                appName: 'Compara IA Test',
                welcomeTokens: 100
            };

            const res = await startTestServer()
                .post('/api/admin/config')
                .set('Authorization', `Bearer ${masterToken}`)
                .send(updates);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify
            const resGet = await startTestServer()
                .get('/api/admin/config')
                .set('Authorization', `Bearer ${masterToken}`);
            expect(resGet.body.appName).toBe('Compara IA Test');
            expect(resGet.body.welcomeTokens).toBe(100);
        });
    });

    describe('Infra Config (Read-Only)', () => {
        test('GET /api/admin/config/db should return sanitized db config', async () => {
            const res = await startTestServer()
                .get('/api/admin/config/db')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('host');
            expect(res.body).toHaveProperty('name');
            // Should not return password
            expect(res.body.password).toBeUndefined();
        });

        test('GET /api/admin/config/redis should return sanitized redis config', async () => {
            const res = await startTestServer()
                .get('/api/admin/config/redis')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('host');
        });

        test('GET /api/admin/config/storage should return sanitized storage config', async () => {
            const res = await startTestServer()
                .get('/api/admin/config/storage')
                .set('Authorization', `Bearer ${masterToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('endpoint');
        });
    });

    describe('Connection Tests', () => {
        test('POST /api/admin/test-connection (DB) - Success', async () => {
            const res = await startTestServer()
                .post('/api/admin/test-connection')
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ type: 'db' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/Conexão estabelecida/);
        });

        test('POST /api/admin/test-connection (Redis) - Success (if redis available) or Handle Error', async () => {
            // Redis might not be mocked effectively here if using real connection manager
            // But we can try
            const res = await startTestServer()
                .post('/api/admin/test-connection')
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ type: 'redis' });

            // If redis is down in test env, it might fail, but let's assume valid config
            // If utilizing mock redis in connectionManager (isTest=true), it should pass
            expect(res.status).toBe(200);
        });

        test('POST /api/admin/test-connection (Storage) - Success', async () => {
            const res = await startTestServer()
                .post('/api/admin/test-connection')
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ type: 'storage' });

            expect(res.status).toBe(200);
        });

        test('POST /api/admin/test-connection - Invalid Type', async () => {
            const res = await startTestServer()
                .post('/api/admin/test-connection')
                .set('Authorization', `Bearer ${masterToken}`)
                .send({ type: 'invalid' });

            expect(res.status).toBe(400);
        });
    });
});


const aiFactory = require('./services/aiFactory');
const logger = require('./utils/logger');
require('dotenv').config({ path: './server/.env' });

(async () => {
    console.log('--- AI TRAFFIC TEST ---');
    try {
        /* Env check removed - relying on DB config via aiFactory */
        if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
            console.log('[INFO] No Env Keys. Relying on DB Config...');
        }

        console.log('Provider selected:', process.env.AI_PROVIDER || 'Gemini (default)');
        const ai = await aiFactory.getAIClient();
        console.log(`Client initialized: ${ai.provider} / ${ai.modelName}`);

        console.log('Sending Test Prompt...');
        const start = Date.now();
        const result = await ai.generateContent('Responda apenas: OK', 'System Test');
        const duration = Date.now() - start;

        console.log(`[PASS] Response received in ${duration}ms`);
        console.log(`Response: "${result?.trim()}"`);
        process.exit(0);
    } catch (err) {
        console.error('[FAIL] Traffic Error:', err.message);
        if (err.response) console.error('Status:', err.response.status);
        process.exit(1);
    }
})();


/**
 * AI Service Factory
 * Responsável por instanciar o provedor correto (Gemini ou OpenAI)
 * com base na configuração salva no banco de dados.
 */
const { GoogleGenAI } = require("@google/genai");
const connectionManager = require('../db/connectionManager');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/crypto');

// Cache Globals
let cachedConfig = null;
let cacheExpiry = 0;
const CACHE_TTL = 30000; // 30 seconds

// New cache client globals
let currentProvider = 'gemini';
let cachedClient = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 30000;

// Pub/Sub state
let redisSubscriber = null;
let pubsubStatus = 'initializing';  // initializing | enabled | degraded

const looksMasked = (value) => typeof value === 'string' && value.includes('***');
const looksLikeOpenAIKey = (value) => /^sk-[A-Za-z0-9_\-]{10,}/.test(value);
const looksLikeGeminiKey = (value) => /^AIza[0-9A-Za-z_\-]{10,}/.test(value);

const resolveDbKey = (value, provider) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (looksMasked(raw)) return null;

    if (raw.includes(':')) {
        try {
            return decrypt(raw);
        } catch (err) {
            logger.warn('[LLM] Failed to decrypt key from DB', { provider, error: err.message });
        }
    }

    const isPlainOpenAI = provider === 'openai' && looksLikeOpenAIKey(raw);
    const isPlainGemini = provider === 'gemini' && looksLikeGeminiKey(raw);
    if (isPlainOpenAI || isPlainGemini) {
        logger.warn('[LLM] Plaintext key detected in DB. Please re-save in Admin to encrypt.', { provider });
        return raw;
    }

    return null;
};

const clearCache = () => {
    cachedConfig = null;
    cacheExpiry = 0;
    logger.info('[LLM] Cache cleared');
};

// Initialize Subscriber for distributed cache invalidation
const initSubscriber = async () => {
    try {
        const redis = await connectionManager.getRedis();
        if (!redis) {
            logger.warn('[LLM] Redis not available, pub/sub disabled');
            pubsubStatus = 'degraded';
            return;
        }

        // Create dedicated subscriber client (duplicate main client)
        console.log('[DEBUG] Redis object keys:', Object.keys(redis));
        console.log('[DEBUG] Redis constructor:', redis.constructor.name);
        redisSubscriber = redis.duplicate();

        // Resilient event handlers
        redisSubscriber.on('error', (err) => {
            logger.error('[LLM] Pub/Sub subscriber error', { error: err.message });
            pubsubStatus = 'degraded';
        });

        redisSubscriber.on('end', () => {
            logger.warn('[LLM] Pub/Sub subscriber disconnected');
            pubsubStatus = 'degraded';
        });

        redisSubscriber.on('reconnecting', () => {
            logger.info('[LLM] Pub/Sub subscriber reconnecting...');
        });

        redisSubscriber.on('ready', async () => {
            logger.info('[LLM] Pub/Sub subscriber ready, resubscribing...');
            try {
                await redisSubscriber.subscribe('llm_config_updated');
                pubsubStatus = 'enabled';
                logger.info('[LLM] Pub/Sub resubscribed successfully');
            } catch (err) {
                logger.error('[LLM] Failed to resubscribe', { error: err.message });
                pubsubStatus = 'degraded';
            }
        });

        // Message handler
        redisSubscriber.on('message', (channel, message) => {
            if (channel === 'llm_config_updated') {
                logger.info('[LLM] Cache invalidated via pub/sub', { ts: message });
                clearCache();
            }
        });

        // Initial subscription
        await redisSubscriber.connect();
        await redisSubscriber.subscribe('llm_config_updated');
        pubsubStatus = 'enabled';
        logger.info('[LLM] Pub/Sub subscriber initialized');

    } catch (error) {
        logger.error('[LLM] Subscriber init error', { error: error.message });
        pubsubStatus = 'degraded';
        // Don't crash boot - continue with local cache only
    }
};
// Publish config update event
const publishConfigUpdate = async () => {
    try {
        const redis = await connectionManager.getRedis();
        if (redis) {
            await redis.publish('llm_config_updated', Date.now().toString());
            logger.info('[LLM] Config update published');
        }
    } catch (error) {
        logger.error('[LLM] Failed to publish config update', { error: error.message });
    }
};

// Initialize subscriber on module load
initSubscriber().catch(err => logger.error('[LLM] Subscriber init error', err));

// ... existing code ...

async function getAIClient(forceRefresh = false) {
    let config = {};

    // 1. Cache Check
    if (!forceRefresh && cachedConfig && Date.now() < cacheExpiry) {
        config = cachedConfig;
    } else {
        // 2. Fetch Config
        const db = connectionManager.getMaster();
        const configRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();

        if (configRow && configRow.value) {
            config = typeof configRow.value === 'string' ? JSON.parse(configRow.value) : configRow.value;
        }

        // Update Cache
        cachedConfig = config;
        cacheExpiry = Date.now() + CACHE_TTL;
    }

    const provider = config.activeAIProvider || 'Google Gemini';

    // --- GOOGLE GEMINI ---
    if (provider === 'Google Gemini') {
        // PRODUCTION RULE: KEY MUST BE IN DB (ENCRYPTED)
        // Fallback to Env allowed only in DEV/TEST
        let apiKey = resolveDbKey(config.geminiKey, 'gemini');

        if (!apiKey && process.env.NODE_ENV !== 'production') {
            apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        }

        // PRODUCTION RULE: No mock in production, fail fast
        if (!apiKey) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('GEMINI_KEY_REQUIRED: Chave Gemini não configurada em produção. Configure no Superadmin.');
            }
            // Development: explicit mock only if flag enabled
            if (process.env.ENABLE_MOCK_AI !== 'true') {
                throw new Error('GEMINI_KEY_REQUIRED: Chave não configurada. Use ENABLE_MOCK_AI=true para mock em dev.');
            }
            logger.warn('[LLM] Using MOCK ai (development mode with ENABLE_MOCK_AI=true)');
            return {
                provider: 'Gemini (Mock)',
                modelName: 'mock-model',
                generateContent: async () => "Mock Content",
                generateJSON: async (prompt, schema) => ({
                    score: 85,
                    summary: "Mock Analysis for QA Validation. System is functional.",
                    recommendation: true
                })
            };
        }

        const googleAI = new GoogleGenAI({ apiKey });

        return {
            provider: 'Gemini',
            modelName: config.geminiModel || 'gemini-2.5-flash',
            generateContent: async (prompt, systemInstruction) => {
                const model = config.geminiModel || 'gemini-2.5-flash';
                const result = await googleAI.models.generateContent({
                    model: model,
                    contents: prompt,
                    config: { systemInstruction }
                });
                return result.text;
            },
            // Wrapper for JSON generation
            generateJSON: async (prompt, schema, systemInstruction) => {
                const model = config.geminiModel || 'gemini-2.5-flash';
                const result = await googleAI.models.generateContent({
                    model: model,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        systemInstruction
                    }
                });
                return JSON.parse(result.text);
            }
        };
    }

    // --- OPENAI ---
    else if (provider.includes('OpenAI')) {
        let apiKey = resolveDbKey(config.openaiKey, 'openai');

        if (!apiKey && process.env.NODE_ENV !== 'production') {
            apiKey = process.env.OPENAI_API_KEY;
        }

        if (!apiKey) throw new Error("Chave OpenAI nao configurada.");

        const model = config.openaiModel || 'gpt-4o';
        const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '60000', 10);
        const openaiBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, '');
        const openaiOrg = config.openaiOrg || process.env.OPENAI_ORG_ID || process.env.OPENAI_ORG || '';
        const openaiProject = config.openaiProject || process.env.OPENAI_PROJECT || process.env.OPENAI_PROJECT_ID || '';

        if (typeof fetch !== 'function') {
            throw new Error('Fetch API indisponivel no runtime do Node.');
        }

        const safeJsonParse = (value) => {
            if (!value || typeof value !== 'string') return null;
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        };

        const extractJsonFromText = (value) => {
            if (!value || typeof value !== 'string') return null;
            const cleaned = value
                .trim()
                .replace(/^```json/i, '')
                .replace(/^```/i, '')
                .replace(/```$/i, '')
                .trim();
            const firstObject = cleaned.indexOf('{');
            const lastObject = cleaned.lastIndexOf('}');
            if (firstObject !== -1 && lastObject > firstObject) {
                return safeJsonParse(cleaned.slice(firstObject, lastObject + 1));
            }
            const firstArray = cleaned.indexOf('[');
            const lastArray = cleaned.lastIndexOf(']');
            if (firstArray !== -1 && lastArray > firstArray) {
                return safeJsonParse(cleaned.slice(firstArray, lastArray + 1));
            }
            return safeJsonParse(cleaned);
        };

        const fetchJson = async (url, options = {}) => {
            const requestTimeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : timeoutMs;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
            try {
                const { timeoutMs: _ignored, ...fetchOptions } = options || {};
                const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
                const text = await response.text();
                let data = null;
                try {
                    data = text ? JSON.parse(text) : null;
                } catch {
                    data = null;
                }
                return { response, data, raw: text };
            } finally {
                clearTimeout(timer);
            }
        };

        const callOpenAIChat = async (payload, options = {}) => {
            const { allowTemperatureFallback = true, allowTimeoutRetry = true, timeoutMs: overrideTimeoutMs } = options || {};
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            if (openaiOrg) headers['OpenAI-Organization'] = openaiOrg;
            if (openaiProject) headers['OpenAI-Project'] = openaiProject;

            const isSlowModel = /^gpt-5/i.test(payload?.model || '') || /^o[0-9]/i.test(payload?.model || '');
            const modelTimeoutMs = Number.isFinite(overrideTimeoutMs)
                ? overrideTimeoutMs
                : (isSlowModel ? Math.max(timeoutMs, 120000) : timeoutMs);

            let response, data, raw;
            try {
                ({ response, data, raw } = await fetchJson(`${openaiBaseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    timeoutMs: modelTimeoutMs
                }));
            } catch (err) {
                const isAbort = err?.name === 'AbortError' || /aborted/i.test(err?.message || '');
                if (isAbort && allowTimeoutRetry) {
                    const retryTimeout = Math.max(modelTimeoutMs * 2, 120000);
                    logger.warn('openai.request.timeout', { model: payload?.model, timeoutMs: modelTimeoutMs });
                    return callOpenAIChat(payload, {
                        ...options,
                        allowTimeoutRetry: false,
                        timeoutMs: retryTimeout
                    });
                }
                throw err;
            }

            if (!response.ok) {
                const message = data?.error?.message || response.statusText || 'Erro desconhecido';
                const tempUnsupported = /temperature/i.test(message) && /default|only the default|does not support/i.test(message);
                const hasTemp = Object.prototype.hasOwnProperty.call(payload || {}, 'temperature');
                if (allowTemperatureFallback && hasTemp && tempUnsupported) {
                    const retryPayload = { ...payload };
                    delete retryPayload.temperature;
                    return callOpenAIChat(retryPayload, { allowTemperatureFallback: false });
                }
                const err = new Error(`OpenAI Error (${response.status}): ${message}`);
                err.status = response.status;
                err.details = data || raw;
                throw err;
            }

            return data;
        };

        const toTextPrompt = (prompt) => {
            if (typeof prompt === 'string') return prompt;
            if (!Array.isArray(prompt)) return JSON.stringify(prompt);
            return prompt
                .map((entry) => {
                    if (!entry || !entry.parts) return '';
                    return entry.parts
                        .map((part) => part.text || `[${part.inlineData?.mimeType || 'file'}]`)
                        .join('\n');
                })
                .join('\n');
        };

        return {
            provider: 'OpenAI',
            modelName: model,
            generateContent: async (prompt, systemInstruction) => {
                const modelDisallowsTemp = /^(gpt[-_]?5|o[0-9])/i.test(String(model || '').trim());
                const msgs = [
                    { role: 'system', content: systemInstruction || 'You are a helpful assistant.' },
                    { role: 'user', content: toTextPrompt(prompt) }
                ];

                const data = await callOpenAIChat({
                    model: model,
                    messages: msgs,
                    ...(modelDisallowsTemp ? {} : { temperature: 0.2 })
                });

                const content = data?.choices?.[0]?.message?.content;
                if (!content) {
                    throw new Error('OpenAI retornou resposta vazia.');
                }
                return content;
            },
            generateJSON: async (prompt, schema, systemInstruction) => {
                const modelDisallowsTemp = /^(gpt[-_]?5|o[0-9])/i.test(String(model || '').trim());
                const schemaHint = schema ? `
Schema esperado (JSON): ${JSON.stringify(schema)}` : '';
                const baseSystem =
                    (systemInstruction || '') +
                    "\nRESTRICTION: Responda SOMENTE com JSON valido." +
                    schemaHint;
                const msgs = [
                    { role: 'system', content: baseSystem.trim() },
                    { role: 'user', content: toTextPrompt(prompt) }
                ];

                let data;
                try {
                    data = await callOpenAIChat({
                        model: model,
                        messages: msgs,
                        ...(modelDisallowsTemp ? {} : { temperature: 0.2 }),
                        response_format: { type: "json_object" }
                    });
                } catch (err) {
                    const message = err?.message || '';
                    const isResponseFormatIssue =
                        /response_format|json_object|json mode|unsupported|invalid/i.test(message);
                    if (!isResponseFormatIssue) {
                        logger.error('openai.generate_json.failed', { message, model }, err);
                        throw err;
                    }

                    logger.warn('openai.generate_json.retry_without_response_format', { model, message });
                    data = await callOpenAIChat({
                        model: model,
                        messages: msgs,
                        ...(modelDisallowsTemp ? {} : { temperature: 0.2 })
                    });
                }

                const content = data?.choices?.[0]?.message?.content || '';
                const directParsed = safeJsonParse(content);
                if (directParsed) return directParsed;

                const extracted = extractJsonFromText(content);
                if (extracted) return extracted;

                logger.warn('openai.generate_json.parse_failed', {
                    model,
                    preview: content ? content.slice(0, 200) : ''
                });
                throw new Error('OpenAI retornou JSON invalido.');
            }
        };
    }

    // --- ANTHROPIC ---
    else if (provider.includes('Anthropic') || provider.includes('Claude')) {
        let apiKey = resolveDbKey(config.anthropicKey, 'anthropic');

        if (!apiKey && process.env.NODE_ENV !== 'production') {
            apiKey = process.env.ANTHROPIC_API_KEY;
        }

        if (!apiKey) throw new Error("Chave Anthropic não configurada.");

        const model = config.anthropicModel || 'claude-3-5-sonnet-20241022';
        const timeoutMs = parseInt(process.env.ANTHROPIC_TIMEOUT_MS || '60000', 10);
        
        if (typeof fetch !== 'function') {
            throw new Error('Fetch API indisponível no runtime do Node.');
        }

        const safeJsonParse = (value) => {
            if (!value || typeof value !== 'string') return null;
            try { return JSON.parse(value); } catch { return null; }
        };

        const extractJsonFromText = (value) => {
            if (!value || typeof value !== 'string') return null;
            const cleaned = value.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            const firstObject = cleaned.indexOf('{');
            const lastObject = cleaned.lastIndexOf('}');
            if (firstObject !== -1 && lastObject > firstObject) return safeJsonParse(cleaned.slice(firstObject, lastObject + 1));
            const firstArray = cleaned.indexOf('[');
            const lastArray = cleaned.lastIndexOf(']');
            if (firstArray !== -1 && lastArray > firstArray) return safeJsonParse(cleaned.slice(firstArray, lastArray + 1));
            return safeJsonParse(cleaned);
        };

        const fetchJson = async (url, options = {}) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                const raw = await response.text();
                let data;
                try { data = JSON.parse(raw); } catch { throw new Error(`Non-JSON response: ${response.status} ${raw.slice(0, 50)}`); }
                if (!response.ok) {
                    const err = new Error(data?.error?.message || `HTTP ${response.status}`);
                    err.status = response.status;
                    err.details = data || raw;
                    throw err;
                }
                return data;
            } finally {
                clearTimeout(id);
            }
        };

        const toTextPrompt = (prompt) => {
            if (typeof prompt === 'string') return prompt;
            if (!Array.isArray(prompt)) return JSON.stringify(prompt);
            return prompt.map(entry => entry?.parts?.map(part => part.text || `[${part.inlineData?.mimeType || 'file'}]`).join('\n') || '').join('\n');
        };

        const callAnthropicMessage = async (payload) => {
            return fetchJson('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 8192,
                    ...payload
                })
            });
        };

        return {
            provider: 'Anthropic',
            modelName: model,
            generateContent: async (prompt, systemInstruction) => {
                const finalSystemInstruction = (systemInstruction || 'You are a helpful assistant.') + (config.customSystemPrompt ? `\n\nDiretrizes Customizadas:\n${config.customSystemPrompt}` : '');
                
                const data = await callAnthropicMessage({
                    system: finalSystemInstruction,
                    messages: [{ role: 'user', content: toTextPrompt(prompt) }]
                });

                const content = data?.content?.[0]?.text;
                if (!content) throw new Error('Anthropic retornou resposta vazia.');
                return content;
            },
            generateJSON: async (prompt, schema, systemInstruction) => {
                const schemaHint = schema ? `\nSchema esperado (JSON): ${JSON.stringify(schema)}` : '';
                const finalSystemInstruction = (systemInstruction || '') + (config.customSystemPrompt ? `\n\nDiretrizes Customizadas:\n${config.customSystemPrompt}` : '');
                const baseSystem = finalSystemInstruction.trim() + "\nRESTRICTION: Responda SOMENTE com JSON valido." + schemaHint;
                
                const data = await callAnthropicMessage({
                    system: baseSystem,
                    messages: [{ role: 'user', content: toTextPrompt(prompt) }]
                });

                const content = data?.content?.[0]?.text || '';
                const directParsed = safeJsonParse(content);
                if (directParsed) return directParsed;

                const extracted = extractJsonFromText(content);
                if (extracted) return extracted;

                throw new Error('Anthropic retornou JSON invalido.');
            }
        };
    }

    throw new Error(`Provedor desconhecido: ${provider}`);
}

module.exports = { getAIClient, clearCache, publishConfigUpdate };

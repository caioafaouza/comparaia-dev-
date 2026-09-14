
const connectionManager = require('../db/connectionManager');
const billingService = require('../services/billingService');
const { encrypt, decrypt, maskKey } = require('../utils/crypto');
const { getAIClient, clearCache, publishConfigUpdate } = require('../services/aiFactory');
const { normalizeEmail, normalizeCnpj, validateCpfCnpj } = require('../utils/normalize');

// Helper to get config table
const getConfigTable = () => connectionManager.getMaster()('system_config');

const LEGACY_PLAN_PRICES = {
    STARTER: 0,
    PRO: 499,
    ENTERPRISE: 2900,
    FREE: 0,
};

const normalizePlanKey = (value) => String(value || '').trim().toUpperCase();

const TIMEZONE_BRAZIL = 'America/Sao_Paulo';

const getDateKeyInTimezone = (date, timeZone = TIMEZONE_BRAZIL) => {
    if (!date) return null;
    const dt = new Date(date);
    if (Number.isNaN(dt.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(dt);
};

const buildPlanPriceResolver = async (db) => {
    const rows = await db('token_plans')
        .select('id', 'slug', 'price')
        .where((qb) => qb.where({ active: true }).orWhereNull('active'));

    const priceByKey = {};
    rows.forEach((row) => {
        const price = Number(row.price || 0);
        const idKey = normalizePlanKey(row.id);
        const slugKey = normalizePlanKey(row.slug);
        if (idKey) priceByKey[idKey] = price;
        if (slugKey) priceByKey[slugKey] = price;
    });

    return (planId) => {
        const key = normalizePlanKey(planId);
        if (!key) return 0;
        if (priceByKey[key] !== undefined) return priceByKey[key];
        return LEGACY_PLAN_PRICES[key] || 0;
    };
};

const getGlobalConfig = async (req, res) => {
    try {
        const configRow = await getConfigTable().where({ key: 'GLOBAL_CONFIG' }).first();
        let config = {};

        if (configRow && configRow.value) {
            config = typeof configRow.value === 'string'
                ? JSON.parse(configRow.value)
                : configRow.value;
        }

        // Fallbacks
        const defaultConfig = {
            appName: 'Compara IA',
            branding: {
                logoUrl: '',
                primaryColor: '#4f46e5',
                secondaryColor: '#10b981'
            },
            supportEmail: 'suporte@comparaia.com',
            welcomeTokens: 50,
            baseCostPerJob: 5,
            costPerCandidate: 1,
            activeAIProvider: 'Google Gemini',
            geminiModel: 'gemini-2.5-flash',
            openaiModel: 'gpt-4o',
            openaiOrg: '',
            openaiProject: '',
            stabilityKey: '',
            customSystemPrompt: '',
            enablePublicSignup: true,
            maintenanceMessage: '',
            maxFileSizeGlobal: 10,
            allowedFileTypes: ['pdf'],
            jobRetentionDays: 90
        };

        // Merge stored config
        const merged = { ...defaultConfig, ...config };

        // Mask sensitive fields
        if (merged.geminiKey) merged.geminiKey = maskKey(merged.geminiKey);
        if (merged.openaiKey) merged.openaiKey = maskKey(merged.openaiKey);
        if (merged.stabilityKey) merged.stabilityKey = maskKey(merged.stabilityKey);

        res.json(merged);
    } catch (error) {
        console.error('Get Config Error:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
};

// Public config (safe subset) for tenants and unauthenticated UI
const getPublicConfig = async (req, res) => {
    try {
        const configRow = await getConfigTable().where({ key: 'GLOBAL_CONFIG' }).first();
        let config = {};

        if (configRow && configRow.value) {
            config = typeof configRow.value === 'string'
                ? JSON.parse(configRow.value)
                : configRow.value;
        }

        const defaultConfig = {
            appName: 'Compara IA',
            branding: {
                logoUrl: '',
                primaryColor: '#4f46e5',
                secondaryColor: '#10b981'
            },
            supportEmail: 'suporte@comparaia.com',
            maintenanceMessage: ''
        };

        const merged = { ...defaultConfig, ...config };

        res.json({
            appName: merged.appName,
            branding: merged.branding,
            supportEmail: merged.supportEmail,
            maintenanceMessage: merged.maintenanceMessage
        });
    } catch (error) {
        console.error('Get Public Config Error:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
};

const updateGlobalConfig = async (req, res) => {
    try {
        const newConfig = req.body;
        const db = connectionManager.getMaster();

        // Upsert logic for SQLite/Postgres compatibility
        // Upsert logic for SQLite/Postgres compatibility
        const existingRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
        let currentConfig = {};
        if (existingRow && existingRow.value) {
            currentConfig = typeof existingRow.value === 'string' ? JSON.parse(existingRow.value) : existingRow.value;
        }

        const keysToSecure = ['geminiKey', 'openaiKey', 'stabilityKey'];

        keysToSecure.forEach(key => {
            if (newConfig[key]) {
                // If masked value is sent, keep existing value when available
                if (newConfig[key].includes('***')) {
                    if (currentConfig[key]) {
                        newConfig[key] = currentConfig[key];
                        return;
                    }
                    throw new Error(`MASKED_INPUT_NOT_ALLOWED: ${key} contains masked value. Please paste the complete API key.`);
                }
                // New value -> Encrypt
                newConfig[key] = encrypt(newConfig[key]);
            } else if (newConfig[key] === '') {
                // Explicit clear
                newConfig[key] = '';
            } else {
                // Missing in payload -> keep existing
                if (currentConfig[key]) newConfig[key] = currentConfig[key];
            }
        });

        if (existingRow) {
            await db('system_config').where({ key: 'GLOBAL_CONFIG' }).update({
                value: JSON.stringify(newConfig),
                updated_at: new Date()
            });
        } else {
            await db('system_config').insert({
                key: 'GLOBAL_CONFIG',
                value: JSON.stringify(newConfig)
            });
        }

        // Invalidate AI Cache immediately (local)
        clearCache();

        // Publish to all instances via Redis Pub/Sub
        await publishConfigUpdate();

        res.json({ success: true, message: 'Configuração salva com sucesso.' });
    } catch (error) {
        console.error('Update Config Error:', error);
        res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
};

// GET /api/admin/tenants
const getAllTenants = async (req, res) => {
    try {
        const db = connectionManager.getMaster();
        const resolvePlanPrice = await buildPlanPriceResolver(db);
        const tenants = await db('tenants')
            .select('id', 'name', 'slug', 'status', 'plan', 'created_at', 'cnpj', 'phone', 'sector', 'purchase_volume', 'custom_domain', 'brand_color', 'logo_url', 'db_name')
            .orderBy('created_at', 'desc');

        const results = [];

        for (const tenant of tenants) {
            let userCount = 0;
            let totalJobs = 0;
            try {
                const usersCount = await db.withSchema(tenant.db_name).count('id as count').from('users').first();
                userCount = parseInt(usersCount?.count || 0);
            } catch { }
            try {
                const jobsCount = await db.withSchema(tenant.db_name).count('id as count').from('comparison_jobs').first();
                totalJobs = parseInt(jobsCount?.count || 0);
            } catch { }

            let wallet = { balance: 0 };
            try {
                wallet = await billingService.getTenantWalletBalance(tenant);
            } catch (err) {
                console.warn(`Failed to fetch wallet for tenant ${tenant.id}:`, err.message);
            }

            const tenantMrr = tenant.status === 'ACTIVE'
                ? resolvePlanPrice(tenant.plan)
                : 0;
            results.push({
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                status: tenant.status,
                plan: tenant.plan,
                createdAt: tenant.created_at,
                cnpj: tenant.cnpj,
                phone: tenant.phone,
                sector: tenant.sector,
                purchaseVolume: tenant.purchase_volume,
                customDomain: tenant.custom_domain,
                brandColor: tenant.brand_color,
                logoUrl: tenant.logo_url,
                userCount,
                totalJobs,
                walletBalance: wallet.balance,
                mrr: tenantMrr
            });
        }

        res.json(results);
    } catch (error) {
        console.error('List Tenants Error:', error);
        res.status(500).json({ error: 'Erro ao listar empresas.' });
    }
};

// DELETE /api/admin/tenants/:id
const deleteTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const db = connectionManager.getMaster();

        const tenant = await db('tenants').where({ id }).first();
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        // Use transaction for atomic deletion
        await db.transaction(async (trx) => {
            const hasUserTenants = await trx.schema.hasTable('user_tenants');
            const hasLegacyTenantId = await trx.schema.hasColumn('users', 'tenant_id');

            // 0. Identify users who might become orphans
            const tenantUsers = hasUserTenants
                ? await trx('user_tenants').where({ tenant_id: id }).select('user_id')
                : [];

            // 1. Delete Dependencies (Manual Cascade)
            // user_tenants (users linked to this tenant)
            if (hasUserTenants) {
                await trx('user_tenants').where({ tenant_id: id }).delete();
            }

            // token_transactions
            await trx('token_transactions').where({ tenant_id: id }).delete();

            // wallet
            await trx('wallet').where({ tenant_id: id }).delete();

            // tenant_api_keys
            if (await trx.schema.hasTable('tenant_api_keys')) {
                await trx('tenant_api_keys').where({ tenant_id: id }).delete();
            }

            // 2. Drop Schema (Cascades to tables within schema)
            try {
                await trx.raw(`DROP SCHEMA IF EXISTS "${tenant.db_name}" CASCADE`);
            } catch (e) {
                console.error(`Error dropping schema ${tenant.db_name}:`, e.message);
                // Continue, as the schema might already be gone
            }

            // 3. Delete Tenant Record
            await trx('tenants').where({ id }).delete();

            // 4. Cleanup Orphans (Users with no remaining tenants)
            if (hasUserTenants) {
                for (const u of tenantUsers) {
                    const remainingLinks = await trx('user_tenants')
                        .where({ user_id: u.user_id })
                        .count('id as count')
                        .first();

                    if (!remainingLinks || parseInt(remainingLinks.count) === 0) {
                        await trx('users').where({ id: u.user_id }).delete();
                        console.log(`[Admin] Deleted orphan user ${u.user_id} after tenant deletion.`);
                    }
                }
            }

            // 5. Legacy cleanup: users with tenant_id column (pre user_tenants)
            if (hasLegacyTenantId) {
                if (hasUserTenants) {
                    await trx('users')
                        .where({ tenant_id: id })
                        .whereNotExists(
                            trx('user_tenants')
                                .select(trx.raw('1'))
                                .whereRaw('user_tenants.user_id = users.id')
                        )
                        .delete();
                } else {
                    await trx('users').where({ tenant_id: id }).delete();
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Delete Tenant Error:', error);
        res.status(500).json({ error: 'Erro ao excluir tenant: ' + error.message });
    }
};

// GET /api/admin/users
const getAllUsersGlobal = async (req, res) => {
    try {
        const db = connectionManager.getMaster();
        const hasWallet = await db.schema.hasTable('wallet');

        // Fetch users from Master DB (Centralized Directory)
        // Joins with user_tenants and tenants to get organization info
        const query = db('users')
            .leftJoin('user_tenants', 'users.id', 'user_tenants.user_id')
            .leftJoin('tenants', 'user_tenants.tenant_id', 'tenants.id');

        if (hasWallet) {
            query.leftJoin('wallet', 'tenants.id', 'wallet.tenant_id');
        }

        const users = await query
            .select(
                'users.id',
                'users.name',
                'users.email',
                'users.role',
                'users.status',
                'tenants.name as tenantName',
                'tenants.id as tenantId',
                'tenants.plan',
                hasWallet ? db.raw('COALESCE(wallet.balance, 0) as "walletBalance"') : db.raw('0 as "walletBalance"')
            )
            .orderBy('users.created_at', 'desc');

        res.json(users);
    } catch (error) {
        console.error('Global Users Error:', error);
        res.status(500).json({ error: 'Erro ao listar usuários globais.' });
    }
};

// GET /api/admin/overview
const getDashboardOverview = async (req, res) => {
    try {
        const db = connectionManager.getMaster();
        const tenants = await db('tenants').select('id', 'name', 'slug', 'db_name', 'plan', 'status', 'created_at', 'cnpj', 'phone', 'sector', 'purchase_volume', 'custom_domain', 'brand_color', 'logo_url');
        const resolvePlanPrice = await buildPlanPriceResolver(db);
        const todayKeyBrazil = getDateKeyInTimezone(new Date(), TIMEZONE_BRAZIL);

        let totalUsers = 0;
        let totalJobs = 0;
        let successJobs = 0;
        let totalLatencyMs = 0;
        let latencyCount = 0;
        let tokensConsumed = 0;

        // Aggregation Loop
        const tenantsWithStats = [];

        for (const tenant of tenants) {
            try {
                // Users Count (Global Directory Check)
                // Fix: Count users linked to this tenant in the master users table
                // This replaces the unreliable `withSchema(tenant.db_name)` check which returns 0 if schema is broken
                const usersCount = await db('user_tenants')
                    .where({ tenant_id: tenant.id })
                    .count('id as count')
                    .first();

                if (usersCount) totalUsers += parseInt(usersCount.count);

                // Jobs Stats
                let tenantJobsCount = 0;
                if (await db.schema.withSchema(tenant.db_name).hasTable('comparison_jobs')) {
                    const jobs = await db.withSchema(tenant.db_name)
                        .select('status', 'cost', 'created_at', 'completed_at')
                        .from('comparison_jobs');

                    tenantJobsCount = jobs.length;
                    totalJobs += tenantJobsCount;

                    jobs.forEach(job => {
                        if (job.status === 'COMPLETED') {
                            successJobs++;

                            // Latency Calculation
                            if (job.created_at && job.completed_at) {
                                const start = new Date(job.created_at).getTime();
                                const end = new Date(job.completed_at).getTime();
                                const diff = end - start;
                                if (diff > 0) {
                                    totalLatencyMs += diff;
                                    latencyCount++;
                                }
                            }
                        }

                        if (job.cost && todayKeyBrazil) {
                            const jobDateKey = getDateKeyInTimezone(job.created_at, TIMEZONE_BRAZIL);
                            if (jobDateKey === todayKeyBrazil) {
                                tokensConsumed += Math.round(parseFloat(job.cost));
                            }
                        }
                    });
                }

                let wallet = { balance: 0 };
                try {
                    wallet = await billingService.getTenantWalletBalance(tenant);
                } catch (err) {
                    // Ignore specific wallet errors
                }

                const tenantMrr = tenant.status === 'ACTIVE'
                    ? resolvePlanPrice(tenant.plan)
                    : 0;
                tenantsWithStats.push({
                    id: tenant.id,
                    name: tenant.name,
                    slug: tenant.slug,
                    plan: tenant.plan,
                    status: tenant.status,
                    createdAt: tenant.created_at,
                    cnpj: tenant.cnpj,
                    phone: tenant.phone,
                    sector: tenant.sector,
                    purchaseVolume: tenant.purchase_volume,
                    customDomain: tenant.custom_domain,
                    brandColor: tenant.brand_color,
                    logoUrl: tenant.logo_url,
                    userCount: usersCount ? parseInt(usersCount.count) : 0,
                    totalJobs: tenantJobsCount,
                    walletBalance: wallet.balance,
                    mrr: tenantMrr
                });
            } catch (e) {
                // Schema might not exist or table missing, ignore
            }
        }

        // Metrics Calculation
        const totalTenants = tenants.length;
        const activeTenants = tenants.filter((t) => t.status === 'ACTIVE').length;
        const totalMrr = tenants.reduce((acc, t) => {
            return acc + (t.status === 'ACTIVE' ? resolvePlanPrice(t.plan) : 0);
        }, 0);

        const inactiveTenants = tenants.filter(t => t.status !== 'ACTIVE').length;
        const churnRate = totalTenants > 0 ? ((inactiveTenants / totalTenants) * 100).toFixed(1) : 0;
        const aiSuccessRate = totalJobs > 0 ? ((successJobs / totalJobs) * 100).toFixed(1) : 100;
        const avgLatencyMs = latencyCount > 0 ? (totalLatencyMs / latencyCount) : 0;

        // Fetch Active Provider
        const configRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
        let activeProvider = 'Google Gemini';
        if (configRow && configRow.value) {
            const cfg = typeof configRow.value === 'string' ? JSON.parse(configRow.value) : configRow.value;
            if (cfg.activeAIProvider) activeProvider = cfg.activeAIProvider;
        }

        res.json({
            mrr: totalMrr,
            totalTenants,
            activeTenants,
            totalUsers,
            totalJobsProcessed: totalJobs,
            tokensConsumedToday: tokensConsumed,
            avgLatencyMs,
            aiSuccessRate,
            churnRate,
            activeAIProvider: activeProvider,
            tenants: tenantsWithStats
        });

    } catch (error) {
        console.error('Desktop Overview Error Details:', error);
        res.status(500).json({ error: 'Erro ao gerar visão geral.', details: error.message });
    }
};

const getOpenAIModels = async (req, res) => {
    try {
        const db = connectionManager.getMaster();
        const configRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
        let config = {};

        if (configRow && configRow.value) {
            config = typeof configRow.value === 'string'
                ? JSON.parse(configRow.value)
                : configRow.value;
        }

        let openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;

        // Try decrypt if it looks encrypted (contains :)
        if (openaiKey && !openaiKey.startsWith('sk-') && openaiKey.includes(':')) {
            try {
                const { decrypt } = require('../utils/crypto');
                openaiKey = decrypt(openaiKey);
            } catch (e) {
                // Ignore
            }
        }

        if (!openaiKey) {
            return res.status(400).json({ error: 'Chave OpenAI não configurada.' });
        }

        const openaiBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, '');
        const openaiOrg = config.openaiOrg || process.env.OPENAI_ORG_ID || process.env.OPENAI_ORG || '';
        const openaiProject = config.openaiProject || process.env.OPENAI_PROJECT || process.env.OPENAI_PROJECT_ID || '';

        const headers = { 'Authorization': `Bearer ${openaiKey}` };
        if (openaiOrg) headers['OpenAI-Organization'] = openaiOrg;
        if (openaiProject) headers['OpenAI-Project'] = openaiProject;

        const response = await fetch(`${openaiBaseUrl}/v1/models`, { headers });

        const data = await response.json();
        if (!response.ok) {
            // CRITICAL FIX: If OpenAI returns 401, return 400 to avoid frontend logout
            const status = response.status === 401 ? 400 : response.status;
            const msg = response.status === 401 ? 'Chave OpenAI inválida ou expirada.' : (data?.error?.message || 'Falha ao listar modelos da OpenAI.');
            return res.status(status).json({ error: msg });
        }

        const models = (data.data || [])
            .map((model) => model.id)
            .filter(Boolean)
            .sort();

        res.json({ models });
    } catch (error) {
        console.error('OpenAI Models Error:', error);
        res.status(500).json({ error: 'Erro ao buscar modelos OpenAI.' });
    }
};

// PATCH /api/admin/tenants/:id
const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, plan, status, cnpj, phone, sector, purchaseVolume, customDomain, brandColor, logoUrl } = req.body;
        const db = connectionManager.getMaster();
        const updates = {};
        if (name) updates.name = name;
        if (plan) updates.plan = plan;
        if (status) updates.status = status;
        if (cnpj !== undefined) {
            const normalizedCnpj = normalizeCnpj(cnpj);
            if (normalizedCnpj && !validateCpfCnpj(normalizedCnpj)) {
                return res.status(400).json({ error: 'CPF/CNPJ invalido. Confira os digitos informados.' });
            }
            updates.cnpj = normalizedCnpj;
            if (normalizedCnpj) {
                const conflict = await db('tenants')
                    .whereRaw("regexp_replace(cnpj, '\\\\D', '', 'g') = ?", [normalizedCnpj])
                    .whereNot({ id })
                    .first();
                if (conflict) return res.status(409).json({ error: 'CPF/CNPJ ja cadastrado.' });
            }
        }
        if (phone !== undefined) updates.phone = phone;
        if (sector !== undefined) updates.sector = sector;
        if (purchaseVolume !== undefined) updates.purchase_volume = purchaseVolume;
        if (customDomain !== undefined) updates.custom_domain = customDomain;
        if (brandColor !== undefined) updates.brand_color = brandColor;
        if (logoUrl !== undefined) updates.logo_url = logoUrl;
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
        }
        updates.updated_at = new Date();
        const updated = await db('tenants').where({ id }).update(updates);
        if (!updated) return res.status(404).json({ error: 'Tenant n\u00e3o encontrado' });
        const tenant = await db('tenants').select('id', 'name', 'slug', 'status', 'plan', 'created_at').where({ id }).first();
        return res.json(tenant);
    } catch (error) {
        console.error('Update Tenant Error:', error);
        return res.status(500).json({ error: 'Erro ao atualizar tenant.' });
    }
};

// PATCH /api/admin/users/:id
const updateGlobalUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, status } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (role) updates.role = role;
        if (status) updates.status = status;

        const db = connectionManager.getMaster();
        if (email) {
            const normalizedEmail = normalizeEmail(email);
            if (!normalizedEmail) return res.status(400).json({ error: 'Email invalido.' });

            const masterConflict = await db('users')
                .whereRaw('lower(email) = ?', [normalizedEmail])
                .whereNot({ id })
                .first();
            if (masterConflict) return res.status(409).json({ error: 'E-mail ja cadastrado.' });

            const tenants = await db('tenants').select('id', 'db_name', 'slug');
            for (const tenant of tenants) {
                try {
                    const tenantConflict = await db.withSchema(tenant.db_name)
                        .from('users')
                        .whereRaw('lower(email) = ?', [normalizedEmail])
                        .whereNot({ id })
                        .first();
                    if (tenantConflict) {
                        return res.status(409).json({
                            error: 'E-mail ja cadastrado.',
                            tenant: tenant.slug || tenant.id
                        });
                    }
                } catch (err) {
                    console.warn(`[Admin] Email conflict check failed in tenant ${tenant.slug || tenant.id}:`, err.message);
                }
            }

            updates.email = normalizedEmail;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
        }
        updates.updated_at = new Date();

        const masterUpdated = await db('users').where({ id }).update(updates);
        if (masterUpdated) {
            return res.json({ success: true, scope: 'MASTER' });
        }

        const tenants = await db('tenants').select('id', 'db_name', 'slug');
        for (const tenant of tenants) {
            try {
                const updated = await db.withSchema(tenant.db_name).from('users').where({ id }).update(updates);
                if (updated) {
                    return res.json({ success: true, tenantId: tenant.id });
                }
            } catch (e) {
                // schema might not exist
            }
        }

        return res.status(404).json({ error: 'Usu\u00e1rio n\u00e3o encontrado' });
    } catch (error) {
        console.error('Update User Error:', error);
        return res.status(500).json({ error: 'Erro ao atualizar usu\u00e1rio.' });
    }
};

// DELETE /api/admin/users/:id
const deleteGlobalUser = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[Admin] Request to delete global user: ${id}`);

        const db = connectionManager.getMaster();

        // Check if user exists first to return 404 if not found
        const initialUser = await db('users').where({ id }).first();
        if (!initialUser) {
            console.warn(`[Admin] User ${id} not found in master users table.`);
            return res.status(404).json({ error: 'Usu??rio n??o encontrado.' });
        }

        const normalizedEmail = initialUser.email ? initialUser.email.toLowerCase() : null;

        await db.transaction(async (trx) => {
            const hasUserTenants = await trx.schema.hasTable('user_tenants');
            const email = normalizedEmail;
            const userRows = email
                ? await trx('users')
                    .select('id')
                    .whereRaw('lower(email) = ?', [email])
                : [{ id }];
            const userIds = userRows.map((row) => row.id);

            // 1. Delete from User Tenants Linkage
            const linksDeleted = (hasUserTenants && userIds.length)
                ? await trx('user_tenants').whereIn('user_id', userIds).delete()
                : 0;
            console.log(`[Admin] Deleted ${linksDeleted} links from user_tenants.`);

            // 2. Delete from Master (by id list and by email to be safe)
            const deleted = userIds.length
                ? await trx('users').whereIn('id', userIds).delete()
                : await trx('users').where({ id }).delete();
            if (email) {
                await trx('users').whereRaw('lower(email) = ?', [email]).delete();
            }
            console.log(`[Admin] Deleted ${deleted} rows from master users.`);

            // 3. Try to delete from ALL tenant schemas
            const tenants = await trx('tenants').select('db_name');
            for (const tenant of tenants) {
                try {
                    if (userIds.length) {
                        await trx.withSchema(tenant.db_name).from('users').whereIn('id', userIds).delete();
                    } else {
                        await trx.withSchema(tenant.db_name).from('users').where({ id }).delete();
                    }
                    if (email) {
                        await trx.withSchema(tenant.db_name).from('users').whereRaw('lower(email) = ?', [email]).delete();
                    }
                } catch (e) { /* ignore schema errors */ }
            }
        });

        // Post-delete safety check (guard against partial deletes)
        const remaining = normalizedEmail
            ? await db('users').select('id').whereRaw('lower(email) = ?', [normalizedEmail])
            : await db('users').select('id').where({ id });
        if (remaining.length > 0) {
            const remainingIds = remaining.map((row) => row.id);
            const hasUserTenants = await db.schema.hasTable('user_tenants');
            if (hasUserTenants) {
                await db('user_tenants').whereIn('user_id', remainingIds).delete();
            }
            await db('users').whereIn('id', remainingIds).delete();

            try {
                const tenants = await db('tenants').select('db_name');
                for (const tenant of tenants) {
                    try {
                        await db.withSchema(tenant.db_name).from('users').whereIn('id', remainingIds).delete();
                        if (normalizedEmail) {
                            await db.withSchema(tenant.db_name).from('users').whereRaw('lower(email) = ?', [normalizedEmail]).delete();
                        }
                    } catch { }
                }
            } catch { }

            console.warn(`[Admin] Post-delete cleanup removed ${remainingIds.length} lingering master user(s).`);
        }

        console.log(`[Admin] User ${id} deleted successfully.`);
        res.status(204).send();
    } catch (error) {
        console.error('Delete Global User Error:', error);
        res.status(500).json({ error: 'Erro ao excluir usu??rio.' });
    }
};

// Smoke Test for AI Provider
const testAIProvider = async (req, res) => {
    try {
        // Force refresh to test NEW config
        const ai = await getAIClient(true);
        const start = Date.now();

        // Simple generation test
        const response = await ai.generateContent("Responder apenas 'OK' se esta mensagem for recebida.");

        const latency = Date.now() - start;

        // SECURITY: Do NOT return actual response, only metadata
        const hasValidResponse = response && (typeof response === 'string' ? response.trim().length > 0 : true);

        res.json({
            success: true,
            provider: ai.provider,
            model: ai.modelName,
            latency,
            status: hasValidResponse ? 'response_received' : 'no_response'
        });
    } catch (error) {
        console.error('Smoke Test Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            provider: error.provider || 'unknown'
        });
    }
};

module.exports = { getGlobalConfig, getPublicConfig, updateGlobalConfig, getAllTenants, deleteTenant, getAllUsersGlobal, deleteGlobalUser, getDashboardOverview, getOpenAIModels, updateTenant, updateGlobalUser, testAIProvider };

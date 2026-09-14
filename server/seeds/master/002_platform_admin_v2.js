// Platform Admin Seed V2 - Resilient with Fallback Password Hashing
// Creates PLATFORM_ADMIN user with bcrypt or fallback
// Run: npx knex seed:run --env development

const crypto = require('crypto');

// Try to load bcrypt, fallback to crypto if not available
let bcrypt;
try {
    bcrypt = require('bcryptjs');
} catch (err) {
    console.warn('[Seed] bcryptjs not available, using crypto.pbkdf2');
    bcrypt = null;
}

const hashPassword = async (password) => {
    if (bcrypt) {
        return await bcrypt.hash(password, 10);
    } else {
        // Fallback: use pbkdf2 (Node built-in)
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        return `pbkdf2:100000:${salt}:${hash}`;  // Custom format for verification
    }
};

exports.seed = async function (knex) {
    // 1. Check existing platform admin
    const existing = await knex('users')
        .where({ email: 'contato@inctec.com.br' })
        .first();

    if (existing) {
        console.log('[Seed] Platform admin already exists, skipping...');
        return;
    }

    // 2. Create platform admin
    const platformAdmin = {
        id: crypto.randomUUID(),
        name: 'INCTEC Platform Admin',
        email: 'contato@inctec.com.br',
        password: await hashPassword('Admin@Inctec2026!'),
        role: 'PLATFORM_ADMIN',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
    };

    // Add tenant_id if column exists (null for platform admin)
    const hasTenantId = await knex.schema.hasColumn('users', 'tenant_id');
    if (hasTenantId) {
        platformAdmin.tenant_id = null;
    }

    await knex('users').insert(platformAdmin);

    console.log(`[Seed] Created platform admin: ${platformAdmin.email}`);

    if (!bcrypt) {
        console.warn('[Seed] WARNING: Using pbkdf2 fallback for password hashing. Install bcryptjs for production.');
    }
};

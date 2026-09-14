// Token Plans Seed V2 - Resilient Introspection-Based
// Auto-adapts to schema (with or without is_default column)
// Run: npx knex seed:run --env development

const crypto = require('crypto');

exports.seed = async function (knex) {
    // 1. Check existing plans
    const existing = await knex('token_plans').select('*').limit(1);

    if (existing.length > 0) {
        console.log('[Seed] token_plans already has data, skipping...');
        return;
    }

    // 2. Introspect schema for is_default column
    const hasIsDefault = await knex.schema.hasColumn('token_plans', 'is_default');

    // 3. Insert free plan (deterministic slug)
    const freePlan = {
        id: crypto.randomUUID(),
        slug: 'free',
        name: 'Free Plan',
        token_limit: 1000,
        price: 0,
        created_at: new Date(),
        updated_at: new Date()
    };

    // Add is_default only if column exists
    if (hasIsDefault) {
        freePlan.is_default = true;
    }

    // Add features if column exists
    const hasFeatures = await knex.schema.hasColumn('token_plans', 'features');
    if (hasFeatures) {
        freePlan.features = JSON.stringify({ max_jobs_per_day: 10, support: 'email' });
    }

    await knex('token_plans').insert(freePlan);

    console.log(`[Seed] Inserted token plan: ${freePlan.name} (slug=${freePlan.slug})`);
};

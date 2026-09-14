
require('dotenv').config();
const knex = require('knex');
const config = require('./knexfile');

const db = knex(config.development);

async function checkMasterJobs() {
    try {
        console.log('--- MASTER SCHEMA CHECK ---');

        // Check table existence
        const hasTable = await db.schema.hasTable('comparison_jobs');
        console.log(`Table 'comparison_jobs' exists: ${hasTable ? 'YES' : 'NO'}`);
        if (!hasTable) {
            process.exit(1);
        }

        // Insert dummy job
        const jobId = crypto.randomUUID();
        console.log('Inserting dummy job...');
        // We need a user ID. Let's find the super admin.
        const admin = await db('users').where({ email: 'contato@inctec.com.br' }).first();
        if (admin) {
            await db('comparison_jobs').insert({
                id: jobId,
                user_id: admin.id,
                reference_name: 'Teste de Validação Master',
                status: 'COMPLETED',
                candidate_count: 1,
                cost: 0,
                error_message: null
            });
            console.log('Inserted job:', jobId);

            // List jobs
            const jobs = await db('comparison_jobs').select('*');
            console.log('Total jobs found:', jobs.length);
            console.log('First job ref:', jobs[0].reference_name);

            // Clean up
            await db('comparison_jobs').where({ id: jobId }).del();
            console.log('Cleaned up dummy job.');
        } else {
            console.log('Skipping insert: Admin user not found (might be seeded differently).');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        db.destroy();
    }
}

const crypto = require('crypto');
checkMasterJobs();

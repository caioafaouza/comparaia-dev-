
require('dotenv').config();
const knex = require('knex');
const config = require('./knexfile');

const db = knex(config.development);

async function checkJobData() {
    try {
        // Set schema to tenant_demo (hardcoded for debugging based on logs)
        await db.raw('SET search_path TO tenant_demo');

        // Get the most recent job
        const job = await db('comparison_jobs')
            .orderBy('created_at', 'desc')
            .first();

        if (!job) {
            console.log('No jobs found.');
            return;
        }

        console.log('--- Job Metadata ---');
        console.log(`ID: ${job.id}`);
        console.log(`Reference: ${job.reference_name}`);
        console.log(`Status: ${job.status}`);

        console.log('\n--- Result Data ---');
        if (job.result) {
            console.log(JSON.stringify(job.result, null, 2));
        } else {
            console.log('Result column is NULL or EMPTY.');
        }

    } catch (error) {
        console.error('Error fetching job:', error);
    } finally {
        db.destroy();
    }
}

checkJobData();

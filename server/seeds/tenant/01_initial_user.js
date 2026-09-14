
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

exports.seed = async function (knex) {
    // Check if any user exists
    const existingUser = await knex('users').first();
    if (existingUser) {
        console.log('Tenant users already exist, skipping seed.');
        return;
    }

    const hash = await bcrypt.hash('123456', 10);

    await knex('users').insert({
        id: crypto.randomUUID(),
        name: 'Tenant Admin',
        email: 'admin@multirede.com.br',
        password: hash,
        role: 'ADMIN',
        status: 'ACTIVE'
    });
    console.log('Tenant Admin created.');
};

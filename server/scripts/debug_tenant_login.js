
const api = 'http://localhost:3000/api';

// Configurar credenciais para teste
// Use credenciais que sabemos que funcionam ou crie um novo tenant
const EMAIL = 'contato@inctec.com.br'; // Podemos testar com este primeiro
const PASS = 'Caio1991*';
const TENANT_SLUG = 'inctec'; // Ajuste conforme necessário

async function run() {
    console.log('--- Debug de Login ---');

    // 1. Tentar login como Admin
    console.log(`\n1. Login com ${EMAIL}...`);
    try {
        const res = await fetch(`${api}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': TENANT_SLUG
            },
            body: JSON.stringify({ email: EMAIL, password: PASS })
        });

        console.log(`Status: ${res.status}`);
        const data = await res.json();

        if (res.ok) {
            console.log('✅ Login Sucesso!');
            console.log('Session Keys:', Object.keys(data));
            console.log('User:', JSON.stringify(data.user, null, 2));
            console.log('Tenant:', JSON.stringify(data.tenant, null, 2));
            console.log('Token (primeiros 20 chars):', data.token.substring(0, 20) + '...');
        } else {
            console.log('❌ Login Falhou:', data);
        }
    } catch (e) {
        console.error('❌ Erro na requisição:', e.message);
    }
}

run();

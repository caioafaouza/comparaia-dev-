
import { http, HttpResponse, StrictRequest } from 'msw';

// Define a handler to capture requests and check headers
export const handlers = [
  // Handler from our previous tests (keep it)
  http.get('/api/admin/overview', async ({ request }) => {
    const tenantIdHeader = request.headers.get('X-Tenant-ID');
    if (tenantIdHeader) {
      return new HttpResponse(JSON.stringify({ error: 'X-Tenant-ID header should not be present' }), { status: 400 });
    }
    return HttpResponse.json({
      totalTenants: 10,
      activeTenants: 8,
      totalUsers: 100,
      mrr: 5000,
      tenants: [
        {
          id: 'tenant-1',
          name: 'Tenant One',
          slug: 'tenant-one',
          status: 'ACTIVE',
          plan: 'PRO',
          cnpj: '00.000.000/0001-00',
          sector: 'Technology',
          purchaseVolume: 'R$ 100k - R$ 1M',
          mrr: 499,
          userCount: 5,
          totalJobs: 20
        },
        {
          id: 'tenant-2',
          name: 'Tenant Two',
          slug: 'tenant-two',
          status: 'SUSPENDED',
          plan: 'STARTER',
          cnpj: '11.111.111/0001-11',
          sector: 'Services',
          purchaseVolume: 'Até R$ 100k',
          mrr: 0,
          userCount: 1,
          totalJobs: 5
        }
      ]
    });
  }),

  http.get('/api/admin/tenants', () => {
    return HttpResponse.json([
      {
        id: 'tenant-1',
        name: 'Tenant One',
        slug: 'tenant-one',
        status: 'ACTIVE',
        plan: 'PRO',
        cnpj: '00.000.000/0001-00',
        sector: 'Technology',
        purchaseVolume: 'R$ 100k - R$ 1M',
        mrr: 499,
        userCount: 5,
        totalJobs: 20
      },
      {
        id: 'tenant-2',
        name: 'Tenant Two',
        slug: 'tenant-two',
        status: 'SUSPENDED',
        plan: 'STARTER',
        cnpj: '11.111.111/0001-11',
        sector: 'Services',
        purchaseVolume: 'Até R$ 100k',
        mrr: 0,
        userCount: 1,
        totalJobs: 5
      }
    ]);
  }),

  // Generic handlers to stabilize the existing broken tests
  // These return minimal data to prevent network errors
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-token',
      user: { id: 'user-1', name: 'Mock User', email: 'mock@user.com', role: 'PLATFORM_ADMIN' },
      tenant: { id: 'master', name: 'Master', slug: 'MASTER' }
    });
  }),

  http.get('/api/admin/users', () => {
    return HttpResponse.json([
      {
        id: 'user-1',
        name: 'User One',
        email: 'u1@test.com',
        role: 'OWNER',
        status: 'ACTIVE',
        tenantName: 'Tenant One',
        tenantId: 'tenant-1',
        plan: 'PRO',
        walletBalance: 100
      }
    ]);
  }),

  http.get('/api/plans', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/register-tenant', () => {
    return HttpResponse.json({ success: true }, { status: 201 });
  }),

  http.get('/api/admin/config', () => {
    return HttpResponse.json({ setting: 'value' });
  }),

  http.get('/api/admin/config/db', () => {
    return HttpResponse.json({
      host: 'localhost',
      port: 5432,
      database: 'compara_ia',
      user: 'postgres',
      ssl: false
    });
  }),

  http.get('/api/admin/config/redis', () => {
    return HttpResponse.json({ host: 'redis.host' });
  }),

  http.get('/api/admin/config/storage', () => {
    return HttpResponse.json({ bucket: 'storage.bucket' });
  }),

  // Catch-all for any other unhandled GET requests to avoid ECONNREFUSED
  http.get('/api/*', () => {
    return HttpResponse.json({});
  }),
  // Catch-all for any other unhandled POST requests
  http.post('/api/*', () => {
    return HttpResponse.json({}, { status: 200 });
  }),
  http.put('/api/*', () => {
    return HttpResponse.json({}, { status: 200 });
  }),
  http.patch('/api/*', () => {
    return HttpResponse.json({}, { status: 200 });
  }),
  http.delete('/api/*', () => {
    return HttpResponse.json({ success: true }, { status: 200 });
  }),
];
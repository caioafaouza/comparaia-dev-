import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGlobalPlatformData, getSession, setSession, getJobDetails, getSlowEndpoint, ApiError } from '../services/api';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { AuthSession } from '../types';



describe('API Client (services/api.ts)', () => {

    beforeEach(() => {
        // Clear localStorage and reset handlers before each test
        localStorage.clear();
        server.resetHandlers();
    });

    describe('Admin Calls Header Security', () => {

        it('[http.no_tenant_header_on_admin_calls] should NOT send X-Tenant-ID header on /admin/* calls', async () => {
            const dirtyAdminSession: AuthSession = {
                token: 'fake-admin-token',
                user: { id: 'user-1', name: 'Admin', email: 'admin@platform.com', role: 'PLATFORM_ADMIN', status: 'ACTIVE', tenantId: 'tenant-123' },
                tenant: { id: 'tenant-123', name: 'Impersonated Tenant', slug: 'impersonated-tenant', plan: 'STARTER', status: 'ACTIVE', createdAt: '2023-01-01' }
            };
            setSession(dirtyAdminSession);

            expect(getSession()?.tenant?.slug).toBe('impersonated-tenant');

            await expect(getGlobalPlatformData()).resolves.not.toThrow();
            const data = await getGlobalPlatformData();
            expect(data.totalTenants).toBe(10);
        });
    });

    describe('Error Handling', () => {
        it('[http.forced_logout_on_401] should clear session and throw ApiError on 401', async () => {
            // ARRANGE
            const session: AuthSession = { token: 'fake-token', user: { id: 'u1', name: 'test', email: 'test@test.com', role: 'MEMBER', status: 'ACTIVE', tenantId: 't1' }, tenant: { id: 't1', name: 'test', slug: 'test', plan: 'STARTER', status: 'ACTIVE', createdAt: '2023-01-01' } };
            setSession(session);
            expect(getSession()).not.toBeNull();

            server.use(
                http.get('/api/jobs/some-id', () => {
                    return new HttpResponse(null, { status: 401 });
                })
            );

            // ACT & ASSERT
            await expect(getJobDetails('some-id')).rejects.toThrow(ApiError);
            await expect(getJobDetails('some-id')).rejects.toMatchObject({
                status: 401,
                message: 'Sessão expirada. Por favor, faça login novamente.'
            });

            // Assert that the session was cleared from localStorage
            // The api call will be made twice, so we need to set the session again
            setSession(session);
            await getJobDetails('some-id').catch(() => { }); // call and ignore error
            expect(getSession()).toBeNull();
        });

        it('[http.show_throttle_on_429] should throw ApiError with Retry-After message on 429', async () => {
            // ARRANGE
            server.use(
                http.get('/api/jobs/another-id', () => {
                    return new HttpResponse(null, {
                        status: 429,
                        headers: { 'Retry-After': '60' }
                    });
                })
            );

            // ACT & ASSERT
            await expect(getJobDetails('another-id')).rejects.toThrow(ApiError);
            await expect(getJobDetails('another-id')).rejects.toMatchObject({
                status: 429,
                message: 'Muitas requisições. Tente novamente em 60s.'
            });
        });
    });

    describe('Network Resilience', () => {
        it('[http.timeout_abort] should throw ApiError on request timeout', async () => {
            // ARRANGE
            server.use(
                http.get('/api/slow-endpoint', async () => {
                    // This delay must be longer than the timeout in the `getSlowEndpoint` function
                    await new Promise(resolve => setTimeout(resolve, 200));
                    return HttpResponse.json({ success: true });
                })
            );

            // ACT & ASSERT
            await expect(getSlowEndpoint()).rejects.toThrow(ApiError);
            await expect(getSlowEndpoint()).rejects.toMatchObject({
                status: 408,
                code: 'TIMEOUT',
                message: 'A requisição demorou muito e foi cancelada.'
            });
        });
    });
});

import {
    AuthSession,
    DashboardMetrics,
    ComparisonJob,
    JobStatus,
    Transaction,
    PlanDefinition,
    ComparisonResponse,
    Tenant,
    User,
    TenantApiKey,
    CRMLead,
    SystemApiKey,
    GlobalLog,
    SystemHealth,
    PaymentGatewayConfig,
    SmtpConfig,
    DatabaseConfig,
    RedisConfig,
    StorageConfig,
    GlobalSystemConfig,
    TransactionalEmailTemplate,
    WebhookConfig,
    WebhookLog,
    ApiGatewayConfig,
    TokenPackage,
    TenantSummary
} from '../types';

// Constants
const API_URL = '/api';
const STORAGE_KEY_SESSION = 'comparaia_session';

// --- Session Management ---

export const getSession = (): AuthSession | null => {
    try {
        const json = localStorage.getItem(STORAGE_KEY_SESSION);
        return json ? JSON.parse(json) : null;
    } catch (e) {
        console.error('Failed to parse session', e);
        return null;
    }
};

export const setSession = (session: AuthSession) => {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    if (session.tenant?.slug) {
        localStorage.setItem('comparaia_last_tenant', session.tenant.slug);
    }
};

export const logout = () => {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    window.location.reload();
};

export const mockLogout = () => { };


// --- API Helpers ---

// Custom Error for API responses
export class ApiError extends Error {
    constructor(message: string, public status: number, public code?: string, public requestId?: string) {
        super(message);
        this.name = 'ApiError';
    }
}

const getHeaders = (endpoint: string, isFormData = false): HeadersInit => {
    const session = getSession();
    const headers: HeadersInit = {};

    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    if (session?.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
    }

    const isPlatformAdmin = session?.user?.role === 'PLATFORM_ADMIN' || session?.tenant?.slug === 'MASTER';
    // Only add tenant header if it's NOT an admin endpoint and not platform admin
    if (session?.tenant?.id && !isPlatformAdmin && !endpoint.startsWith('/admin/')) {
        headers['X-Tenant-ID'] = session.tenant.slug || session.tenant.id;
    }

    return headers;
};

const handleResponse = async (res: Response, endpoint: string) => {
    if (res.status === 401) {
        

        console.warn(`[API] Auth Error 401 - Logging out.`);
        // Don't reload here, let the caller handle it.
        localStorage.removeItem(STORAGE_KEY_SESSION);
        throw new ApiError('Sessão expirada. Por favor, faça login novamente.', res.status, 'AUTH_REQUIRED');
    }

    // ... rest of errors
    if (res.status === 403) {
        throw new ApiError('Você não tem permissão para executar esta ação.', res.status, 'FORBIDDEN');
    }

    if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const msg = retryAfter
            ? `Muitas requisições. Tente novamente em ${retryAfter}s.`
            : 'Muitas requisições. Aguarde um momento.';
        throw new ApiError(msg, res.status, 'RATE_LIMIT_EXCEEDED');
    }

    if (!res.ok) {
        let errorMessage = `Erro ${res.status}: ${res.statusText}`;
        let errorCode = `HTTP_${res.status}`;
        let requestId: string | undefined;

        try {
            const errorData = await res.json();
            errorMessage = errorData.error?.message || errorData.error || errorMessage;
            errorCode = errorData.error?.code || errorCode;
            requestId = errorData.requestId;
        } catch {
            // Ignore if body is not valid JSON
        }
        throw new ApiError(errorMessage, res.status, errorCode, requestId);
    }

    if (res.status === 204) {
        return {};
    }

    return res.json();
};

const apiFetch = async (endpoint: string, options: RequestInit = {}, timeout = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const isFormData = options.body instanceof FormData;

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: getHeaders(endpoint, isFormData), // Pass endpoint to header logic
            cache: 'no-store',
            signal: controller.signal,
        });
        return await handleResponse(res, endpoint);
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new ApiError('A requisição demorou muito e foi cancelada.', 408, 'TIMEOUT');
        }
        // Re-throw structured ApiError or other network errors
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};


// --- Auth ---

export const login = async (email: string, pass: string, tenantSlug?: string): Promise<AuthSession> => {
    // Login now uses the standardized apiFetch.
    // It's still a bit special as it doesn't have a session yet, but apiFetch handles that.
    const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass, tenantSlug })
    });

    const session: AuthSession = {
        token: data.token,
        user: data.user,
        tenant: data.tenant || { id: 'master', name: 'Master', slug: 'MASTER' }
    };
    setSession(session);
    return session;
};

export const register = async (data: any): Promise<AuthSession> => {
    const payload = {
        name: data.company,
        slug: data.company.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        adminName: data.name,
        email: data.email,
        password: data.pass,
        cnpj: data.cnpj,
        phone: data.phone,
        sector: data.sector,
        purchaseVolume: data.purchaseVolume
    };

    // Tenant provisioning can take longer (schema creation + migrations + initial setup)
    const responseData = await apiFetch(`/register-tenant`, {
        method: 'POST',
        body: JSON.stringify(payload)
    }, 180000);

    if (responseData.token) {
        const session: AuthSession = {
            token: responseData.token,
            user: responseData.admin || responseData.user,
            tenant: responseData.tenant
        };
        setSession(session);
        return session;
    }
    // Fallback to login if registration returns no token directly
    return login(data.email, data.pass, responseData.slug || payload.slug);
};

// --- Dashboard & Metrics ---

export const getDashboardMetrics = (tenantId: string): Promise<DashboardMetrics> => {
    return apiFetch(`/dashboard/metrics`);
};

export const requestPasswordReset = (email: string) => {
    return apiFetch(`/auth/password-reset/request`, {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
};

export const verifyPasswordResetCode = (email: string, code: string) => {
    return apiFetch(`/auth/password-reset/verify`, {
        method: 'POST',
        body: JSON.stringify({ email, code }),
    });
};

export const confirmPasswordReset = (email: string, code: string, newPassword: string, confirmPassword: string) => {
    return apiFetch(`/auth/password-reset/confirm`, {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword, confirmPassword }),
    });
};

// --- Public Config ---
export const getPublicConfig = (): Promise<Partial<GlobalSystemConfig>> => {
    return apiFetch(`/config/public`);
};

// --- Jobs ---

export const getJobsPaginated = (tenantId: string, page: number, limit: number, status: JobStatus | 'ALL', search: string) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), search: search || '' });
    if (status !== 'ALL') params.append('status', status);
    return apiFetch(`/jobs?${params.toString()}`);
};

export const getJobDetails = (id: string): Promise<ComparisonJob> => {
    return apiFetch(`/jobs/${id}`);
};

export const createComparisonJob = (
    session: AuthSession,
    refInput: { type: 'file' | 'text', file?: File, content?: string, name?: string },
    candidateFiles: File[],
    language?: string
): Promise<ComparisonJob> => {
    const formData = new FormData();
    if (refInput.type === 'file' && refInput.file) {
        formData.append('reference', refInput.file);
    } else {
        formData.append('referenceText', refInput.content || '');
        formData.append('referenceName', refInput.name || 'Referência');
    }
    candidateFiles.forEach(file => formData.append('candidates', file));
    if (language) {
        formData.append('language', language);
    }

    return apiFetch(`/jobs`, {
        method: 'POST',
        body: formData
    });
};

export const deleteJob = (id: string) => {
    return apiFetch(`/jobs/${id}`, { method: 'DELETE' });
};

export const bulkDeleteJobs = (ids: string[]) => {
    return Promise.all(ids.map(id => deleteJob(id)));
};

export const updateJobStatus = (id: string, status: JobStatus, error?: string) => {
    return apiFetch(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, error })
    });
};

export const updateJobResult = (id: string, result: ComparisonResponse) => {
    return apiFetch(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ result, status: 'COMPLETED' })
    });
};

export const updateJobPrices = (id: string, prices: Record<string, number>) => {
    return apiFetch(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ prices })
    });
};

export const downloadJobReportPdf = async (jobId: string, showDiffOnly = false): Promise<Blob> => {
    const query = showDiffOnly ? '?diff=1' : '';
    const endpoint = `/jobs/${jobId}/report/pdf${query}`;
    const res = await fetch(`${API_URL}${endpoint}`, {
        headers: getHeaders(endpoint)
    });
    if (!res.ok) {
        let message = `Erro ${res.status}`;
        try {
            const data = await res.json();
            message = data.error || message;
        } catch {
            // ignore
        }
        throw new ApiError(message, res.status);
    }
    return res.blob();
};

// --- Tenant ---

export const getTenantDetailsDeep = (tenantId: string): Promise<Tenant> => {
    return apiFetch(`/tenant/details`);
};

export const updateTenant = (id: string, data: Partial<Tenant>) => {
    const session = getSession();
    // Use admin endpoint if platform admin, else self/tenant endpoint
    const endpoint = session?.user?.role === 'PLATFORM_ADMIN' ? `/admin/tenants/${id}` : `/tenant/details`;
    return apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
};

export const deleteTenantSelf = () => {
    return apiFetch(`/tenant/details`, { method: 'DELETE' });
};

export const getTenantApiKeys = (tenantId: string): Promise<TenantApiKey[]> => {
    return apiFetch(`/tenant/api-keys`);
};

export const createTenantApiKey = (tenantId: string, name: string): Promise<TenantApiKey> => {
    return apiFetch(`/tenant/api-keys`, {
        method: 'POST',
        body: JSON.stringify({ name })
    });
};

export const revokeTenantApiKey = (id: string) => {
    return apiFetch(`/tenant/api-keys/${id}/revoke`, { method: 'POST' });
};

// --- Users ---

export const getTenantUsers = (tenantId: string): Promise<User[]> => {
    return apiFetch(`/users`);
};

export const createTenantUser = (user: Partial<User>) => {
    return apiFetch(`/users`, {
        method: 'POST',
        body: JSON.stringify(user)
    });
};

export const updateUser = (id: string, data: Partial<User>) => {
    return apiFetch(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
};

export const deleteTenantUser = (id: string) => {
    return apiFetch(`/users/${id}`, { method: 'DELETE' });
};

export const inviteUser = (email: string, role: string) => {
    return apiFetch(`/users/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
    });
};

// --- Billing ---

export const getWalletBalance = async (tenantId: string): Promise<number> => {
    try {
        const data = await apiFetch(`/billing/wallet`);
        return data.balance || 0;
    } catch { return 0; }
};

export const getTenantTransactions = async (tenantId: string): Promise<Transaction[]> => {
    try {
        const data = await apiFetch(`/billing/transactions`);
        return Array.isArray(data) ? data : [];
    } catch { return []; }
};

export const getPlans = async (): Promise<PlanDefinition[]> => {
    try {
        const session = getSession();
        const url = session?.user?.role === 'PLATFORM_ADMIN' ? `/admin/plans` : `/plans`;
        const data = await apiFetch(url);
        return Array.isArray(data) ? data : [];
    } catch { return []; }
};

export const upgradeTenantPlan = (tenantId: string, planId: string, returnPath?: string) => {
    return apiFetch(`/billing/upgrade-plan`, {
        method: 'POST',
        body: JSON.stringify({ planId, returnPath })
    });
};

export const getPaymentGateways = (tenantId?: string): Promise<PaymentGatewayConfig[]> => {
    const session = getSession();
    const url = session?.user?.role === 'PLATFORM_ADMIN' ? `/admin/payment-gateways` : `/billing/payment-gateways`;
    return apiFetch(url);
};

export const updatePaymentGateway = (data: PaymentGatewayConfig) => {
    return apiFetch(`/admin/payment-gateways`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
};

export const deletePaymentGateway = (provider: string) => {
    return apiFetch(`/admin/payment-gateways/${provider}`, { method: 'DELETE' });
};

export const getTokenPackages = (): Promise<TokenPackage[]> => {
    const session = getSession();
    const url = session?.user?.role === 'PLATFORM_ADMIN' ? `/admin/token-packages` : `/token-packages`;
    return apiFetch(url);
};

export const purchaseTokenPackage = (tenantId: string, packageId: string, returnPath?: string) => {
    return apiFetch(`/billing/purchase-package`, {
        method: 'POST',
        body: JSON.stringify({ packageId, returnPath })
    });
};

export const getBillingOrderStatus = (orderId: string, sync = false) => {
    const query = sync ? '?sync=1' : '';
    return apiFetch(`/billing/orders/${encodeURIComponent(orderId)}${query}`);
};

export const recordPaymentFailure = (tenantId: string, amount: number, reason: string) => {
    return apiFetch(`/billing/payment-failure`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason })
    });
};

// --- Plans (Admin) ---
export const createPlan = (data: any) => {
    return apiFetch(`/admin/plans`, { method: 'POST', body: JSON.stringify(data) });
};
export const updatePlan = (id: string, data: any) => {
    return apiFetch(`/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};
export const deletePlan = (id: string) => {
    return apiFetch(`/admin/plans/${id}`, { method: 'DELETE' });
};

// --- Token Packages (Admin) ---
export const createTokenPackage = (data: any) => {
    return apiFetch(`/admin/token-packages`, { method: 'POST', body: JSON.stringify(data) });
};
export const deleteTokenPackage = (id: string) => {
    return apiFetch(`/admin/token-packages/${id}`, { method: 'DELETE' });
};
export const adminRefillTokens = (tenantId: string, amount: number) => {
    return apiFetch(`/admin/tokens/refill`, { method: 'POST', body: JSON.stringify({ tenantId, amount }) });
};

// --- Audit ---

export const getAuditLogs = (tenantId: string) => {
    return apiFetch(`/audit/logs`);
};

// --- Platform Admin (Backend Endpoints) ---

export const getGlobalPlatformData = () => {
    return apiFetch(`/admin/overview`);
};

export const getTransactions = () => {
    return apiFetch(`/admin/transactions`);
};

export const getAllUsersGlobal = () => {
    return apiFetch(`/admin/users`);
};

export const updateGlobalUser = (id: string, data: any) => {
    return apiFetch(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
};

export const deleteGlobalUser = (id: string) => {
    return apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
};

export const getGlobalLogs = () => {
    return apiFetch(`/admin/logs`);
};

export const getSystemHealth = (): Promise<SystemHealth> => {
    return apiFetch(`/admin/system-health`);
};

export const toggleMaintenanceMode = (enabled: boolean) => {
    return apiFetch(`/admin/system-health/maintenance`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
    });
};

export const clearSystemCache = (target: string) => {
    return apiFetch(`/admin/system-health/cache/clear`, {
        method: 'POST',
        body: JSON.stringify({ target })
    });
};

export const getAIUsageData = (params?: { period?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.period) qs.set('period', params.period);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString();
    return apiFetch(`/admin/ai-usage${query ? `?${query}` : ''}`);
};

export const getGlobalConfig = (): Promise<GlobalSystemConfig> => {
    return apiFetch(`/admin/config`);
};

export const updateGlobalConfig = (config: Partial<GlobalSystemConfig>) => {
    return apiFetch(`/admin/config`, {
        method: 'POST',
        body: JSON.stringify(config)
    });
};

export const getOpenAIModels = () => {
    return apiFetch(`/admin/openai-models`);
};

export const testAIProviderConnection = () => {
    return apiFetch(`/admin/llm/smoke`);
};

// Infra
export const getDatabaseConfig = () => {
    return apiFetch(`/admin/config/db`);
};
export const updateDatabaseConfig = (data: any) => {
    return apiFetch(`/admin/config/db`, { method: 'POST', body: JSON.stringify(data) });
};
export const getRedisConfig = () => {
    return apiFetch(`/admin/config/redis`);
};
export const updateRedisConfig = (data: any) => {
    return apiFetch(`/admin/config/redis`, { method: 'POST', body: JSON.stringify(data) });
};
export const getStorageConfig = () => {
    return apiFetch(`/admin/config/storage`);
};
export const updateStorageConfig = (data: any) => {
    return apiFetch(`/admin/config/storage`, { method: 'POST', body: JSON.stringify(data) });
};
export const testInfrastructureConnection = (type: string) => {
    return apiFetch(`/admin/test-connection`, { method: 'POST', body: JSON.stringify({ type }) });
};
export const getSmtpConfig = () => {
    return apiFetch(`/admin/config/smtp`);
};
export const updateSmtpConfig = (data: any) => {
    return apiFetch(`/admin/config/smtp`, { method: 'POST', body: JSON.stringify(data) });
};
export const testSmtpConnection = (data: Partial<SmtpConfig> & { email?: string }) => {
    return apiFetch(`/admin/config/smtp/test`, { method: 'POST', body: JSON.stringify(data || {}) });
};
export const getTransactionalEmailTemplates = (): Promise<TransactionalEmailTemplate[]> => {
    return apiFetch(`/admin/config/email-templates`);
};
export const updateTransactionalEmailTemplates = (templates: TransactionalEmailTemplate[]) => {
    return apiFetch(`/admin/config/email-templates`, { method: 'POST', body: JSON.stringify({ templates }) });
};
export const updateTransactionalEmailTemplateByKey = (key: string, data: Partial<TransactionalEmailTemplate>) => {
    return apiFetch(`/admin/config/email-templates/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(data) });
};

// API Gateway & Keys
export const getApiGatewayConfig = () => {
    return apiFetch(`/admin/api-gateway`);
};
export const updateApiGatewayConfig = (data: any) => {
    return apiFetch(`/admin/api-gateway`, { method: 'POST', body: JSON.stringify(data) });
};
export const getApiSpec = () => {
    return apiFetch(`/admin/api-spec`);
};
export const getSystemApiKeys = () => {
    return apiFetch(`/admin/system-keys`);
};
export const createSystemApiKey = (name: string, role: string) => {
    return apiFetch(`/admin/system-keys`, { method: 'POST', body: JSON.stringify({ name, role }) });
};
export const revokeSystemApiKey = (id: string) => {
    return apiFetch(`/admin/system-keys/${id}/revoke`, { method: 'POST' });
};

// CRM
export const getCRMLeads = () => {
    return apiFetch(`/admin/crm/leads`);
};
export const createCRMLead = (data: any) => {
    const session = getSession();
    const url = session?.user?.role === 'PLATFORM_ADMIN' ? `/admin/crm/leads` : `/crm/leads`;
    return apiFetch(url, { method: 'POST', body: JSON.stringify(data) });
};
export const updateCRMLead = (id: string, data: any) => {
    return apiFetch(`/admin/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};
export const deleteCRMLead = (id: string) => {
    return apiFetch(`/admin/crm/leads/${id}`, { method: 'DELETE' });
};

// Webhooks
export const getWebhooks = () => {
    return apiFetch(`/admin/webhooks`);
};
export const createWebhook = (data: any) => {
    return apiFetch(`/admin/webhooks`, { method: 'POST', body: JSON.stringify(data) });
};
export const updateWebhook = (id: string, data: any) => {
    return apiFetch(`/admin/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};
export const deleteWebhook = (id: string) => {
    return apiFetch(`/admin/webhooks/${id}`, { method: 'DELETE' });
};
export const getWebhookLogs = (id: string) => {
    return apiFetch(`/admin/webhooks/${id}/logs`);
};
export const testWebhook = (id: string) => {
    return apiFetch(`/admin/webhooks/${id}/test`, { method: 'POST' });
};

// Tenants (Admin)
// Tenants (Admin)
export const adminListTenants = (): Promise<TenantSummary[]> => {
    return apiFetch(`/admin/tenants`);
};

export const impersonateTenant = async (tenantId: string) => {
    throw new Error('Impersonation not implemented');
};
export const deleteTenant = (id: string) => {
    return apiFetch(`/admin/tenants/${id}`, { method: 'DELETE' });
};
export const toggleTenantStatus = (id: string) => {
    return apiFetch(`/admin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'TOGGLE' }) });
};
export const adminCreateTenant = (data: any) => {
    // Note: This endpoint is likely the same as register-tenant, but using it with admin auth context
    return apiFetch(`/register-tenant`, { method: 'POST', body: JSON.stringify(data) });
};

// Stub util
export const initializeMockDB = () => { };
export const cleanupStaleJobs = () => { };

// For testing purposes
export const getSlowEndpoint = () => {
    return apiFetch(`/slow-endpoint`, {}, 50);
};

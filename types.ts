
export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'PLATFORM_ADMIN';

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
}

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type PlanType = 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface Tenant {
  id: string;
  name: string;
  slug?: string;
  plan: PlanType;
  status: TenantStatus;
  createdAt: string;
  cnpj?: string;
  phone?: string;
  sector?: string;
  purchaseVolume?: string;
  customDomain?: string;
  brandColor?: string;
  logoUrl?: string;
}

export interface Comment {
  id: string;
  authorName: string;
  text: string;
  timestamp: string;
}

export interface ProductAttribute {
  name: string;
  referenceValue: string;
  candidateValue: string;
  matchScore: number;
  confidenceScore: number;
  requiresVerification: boolean;
  note?: string;
  comments?: Comment[];
}

export interface CandidateAnalysis {
  productName: string;
  isRecommended: boolean;
  totalScore: number;
  pros: string[];
  cons: string[];
  attributes: ProductAttribute[];
  reasoning: string;
  price?: number;
  currency?: string;
}

export interface ComparisonResponse {
  referenceName: string;
  candidates: CandidateAnalysis[];
  executiveSummary: string;
  shareToken?: string;
}

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ComparisonJob {
  id: string;
  tenantId: string;
  userId: string;
  status: JobStatus;
  referenceName: string;
  candidateCount: number;
  createdAt: string;
  completedAt?: string;
  cost: number;
  result?: ComparisonResponse;
  error?: string;
  language?: string;
}

export interface AuthSession {
  user: User;
  tenant: Tenant;
  token: string;
}

export interface Transaction {
  id: string;
  tenantId: string;
  amount: number;
  description: string;
  date: string;
}

export interface SupplierStats {
  name: string;
  avgScore: number;
  winRate: number;
  totalParticipations: number;
}

export interface DashboardMetrics {
  totalJobs: number;
  totalCandidatesAnalyzed: number;
  estimatedHoursSaved: number;
  estimatedMoneySaved: number;
  recentJobs: ComparisonJob[];
  trends: { moneySaved: number; hoursSaved: number };
  resourceUsage: {
    users: { used: number; total: number };
    storage: { usedGB: number; totalGB: number };
  };
  topSuppliers: SupplierStats[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatResponse {
  text: string;
  sources?: GroundingSource[];
}

export type ReferenceInput =
  | { type: 'file'; file: File }
  | { type: 'text'; content: string; name: string };

export interface PlanLimits {
  monthlyTokens: number;
  maxUsers: number;
  maxStorageGB?: number;
  maxCandidatesPerJob: number;
  // Added to support editing in Tokens module
  maxFileSizeMB?: number;
}

export interface PlanDefinition {
  id: string;
  name: string;
  price: number;
  // Added to support tokens module
  currency?: string;
  active?: boolean;
  limits: PlanLimits;
  features: {
    auditLog: boolean;
    whiteLabel: boolean;
    apiAccess: boolean;
    customDomain: boolean;
    sso: boolean;
    // Added for feature toggles in Admin
    prioritySupport?: boolean;
    customIntegrations?: boolean;
  };
}

export interface TenantSummary extends Tenant {
  userCount: number;
  walletBalance: number;
  totalJobs: number;
  mrr: number;
}

export interface PlatformMetrics {
  mrr: number;
  totalTenants: number;
  activeTenants?: number;
  totalUsers: number;
  totalJobsProcessed: number;
  tenants: TenantSummary[];
  // Added for Admin Overview
  churnRate?: number;
  aiSuccessRate?: number;
  avgLatencyMs?: number;
  tokensConsumedToday?: number;
  activeAIProvider?: string;
  recentEvents?: any[];
}

export interface CRMLead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED';
  value: number;
  probability: number;
  createdAt: string;
  notes?: string;
  // Added for CRM detail panel
  interactions?: Array<{
    type: 'CALL' | 'EMAIL' | 'STATUS_CHANGE' | 'OTHER';
    date: string;
    summary: string;
  }>;
}

export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  // Added for Admin Tokens module
  active?: boolean;
}

export interface GlobalSystemConfig {
  appName: string;
  branding: {
    logoUrl: string;
    primaryColor: string;
    // Added for Admin Settings
    secondaryColor?: string;
  };
  geminiKey?: string;
  // Added for Admin Settings & LLM Config
  supportEmail?: string;
  welcomeTokens?: number;
  baseCostPerJob?: number;
  costPerCandidate?: number;
  activeAIProvider?: string;
  geminiModel?: string;
  openaiKey?: string;
  openaiModel?: string;
  openaiOrg?: string;
  openaiProject?: string;
  stabilityKey?: string;
  anthropicKey?: string;
  anthropicModel?: string;
  customSystemPrompt?: string;
  enablePublicSignup?: boolean;
  maintenanceMessage?: string;
  maxFileSizeGlobal?: number;
  allowedFileTypes?: string[];
  jobRetentionDays?: number;
}

// Added missing interfaces for Platform Admin modules
export interface GlobalLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  service: string;
  message: string;
  metadata?: string;
}

export interface SystemHealth {
  services: Array<{
    name: string;
    status: 'operational' | 'degraded' | 'down';
    latency: number;
    uptime: number;
    history: number[];
  }>;
  maintenanceMode: boolean;
  lastBackup: string;
  dbSize: string;
  cpuLoad: number;
  memoryUsage: number;
  activeThreads: number;
  errorRate: number;
}

export type PaymentProvider = 'STRIPE' | 'MERCADO_PAGO' | 'PAGARME' | 'CUSTOM';

export interface PaymentGatewayConfig {
  provider: PaymentProvider;
  name: string;
  active: boolean;
  isDefault: boolean;
  credentials: {
    publicKey?: string;
    secretKey?: string;
  };
  customInstructions?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  hasPassword?: boolean;
  secure: boolean;
  fromEmail: string;
}

export interface TransactionalEmailTemplate {
  key: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  enabled: boolean;
  variables: string[];
  updatedAt?: string | null;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  pass: string;
  type: string;
  ssl: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  tls: boolean;
  dbIndex: number;
  cacheTTL: number;
  status: string;
}

export interface StorageConfig {
  endpoint: string;
  port?: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export interface AICostDashboardData {
  totalCost30d: number;
  totalRequests30d: number;
  totalTokens30d: number;
  avgLatency30d: number;
  period?: string;
  periodLabel?: string;
  rangeStart?: string;
  rangeEnd?: string;
  dailyUsage: Array<{ date: string; requests: number }>;
  providerDistribution: Array<{ provider: string; percentage: number; color: string }>;
  tokensByTenant: Array<{ label: string; value: number; percentage: number; color: string }>;
  tokensByType: any[];
  recentLogs: AIRequestLog[];
}

export interface AIRequestLog {
  id: string;
  timestamp: string;
  model: string;
  context: string;
  tokensIn: number;
  tokensOut: number;
  latency: number;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  details?: string;
}

export interface Wallet {
  tenantId: string;
  balance: number;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  lastStatus?: 'SUCCESS' | 'FAILURE';
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  timestamp: string;
  statusCode: number;
  latency: number;
  payloadPreview: string;
}

export interface ApiGatewayConfig {
  enabled: boolean;
  apiVersion: string;
  globalRateLimit: number;
  timeoutMs: number;
  corsOrigins: string[];
  enableLogging: boolean;
}

export interface SystemApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  role: 'READ_ONLY' | 'FULL_ACCESS';
  createdAt: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface TenantApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  status: 'ACTIVE' | 'REVOKED';
  rawKey?: string;
}

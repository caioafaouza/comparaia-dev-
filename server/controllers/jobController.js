
const fs = require('fs');
const path = require('path');
const connectionManager = require('../db/connectionManager');
const config = require('../config/env');
const logger = require('../utils/logger');
const { logAudit } = require('../services/auditService');
const billingService = require('../services/billingService');
const reportPdfService = require('../services/reportPdfService');

const sanitizeFilename = (name = '') => name.replace(/[^a-zA-Z0-9._-]/g, '_');

const uploadFilesToStorage = async ({ files, tenant, jobId }) => {
  if (!files || files.length === 0) return [];

  const storage = connectionManager.getStorage();
  if (!storage) {
    throw new Error('Storage client unavailable');
  }

  await connectionManager.ensureBucket(config.storage.bucket);

  const tenantPrefix = tenant?.slug || tenant?.id || 'MASTER';

  const uploads = [];
  for (const file of files) {
    const safeName = sanitizeFilename(file.originalname || 'file');
    const role = sanitizeFilename(file.fieldname || 'file');
    const objectKey = `${tenantPrefix}/${jobId}/${role}-${Date.now()}-${safeName}`;

    await storage.fPutObject(config.storage.bucket, objectKey, file.path, {
      'Content-Type': file.mimetype,
    });

    uploads.push({
      field: file.fieldname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      objectKey,
    });

    try {
      await fs.promises.unlink(file.path);
    } catch {
      // ignore cleanup errors
    }
  }

  return uploads;
};

const parseJsonResult = (value) => {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const coercePrice = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizePriceKey = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '')
  .trim();

const applyPricesToResult = (result, prices) => {
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates)) return result;
  if (!prices || typeof prices !== 'object') return result;

  const normalizedPriceMap = {};
  Object.entries(prices).forEach(([rawKey, value]) => {
    const normalizedKey = normalizePriceKey(rawKey);
    if (normalizedKey) normalizedPriceMap[normalizedKey] = coercePrice(value);
  });

  const updatedCandidates = result.candidates.map((cand) => {
    const key = cand?.productName || cand?.name || cand?.title || '';
    const normalizedKey = normalizePriceKey(key);
    if (!normalizedKey || normalizedPriceMap[normalizedKey] === undefined) return cand;
    return { ...cand, price: normalizedPriceMap[normalizedKey] };
  });

  return { ...result, candidates: updatedCandidates, priceMap: normalizedPriceMap };
};

const normalizeLanguage = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'pt';
  if (raw.startsWith('pt')) return 'pt';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('es')) return 'es';
  return 'pt';
};

const extractLanguageFromRequest = (req) => {
  const bodyLang = req?.body?.language || req?.body?.lang;
  const headerLang = req?.headers?.['x-language'] || req?.headers?.['x-lang'] || req?.headers?.['accept-language'];
  const raw = bodyLang || headerLang || '';
  const first = typeof raw === 'string' ? raw.split(',')[0].split(';')[0] : raw;
  return normalizeLanguage(first);
};

const listJobs = async (req, res) => {
  try {
    const db = req.db;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { status, search } = req.query;

    const applyFilters = (query) => {
      if (status && status !== 'ALL') {
        query.where('status', status);
      }
      if (search) {
        query.where((builder) => {
          builder
            .where('reference_name', 'ilike', `%${search}%`)
            .orWhereRaw('id::text ilike ?', [`%${search}%`]);
        });
      }
      return query;
    };

    // Count (Standalone query)
    let total = 0;
    try {
      let countQuery = db('comparison_jobs');
      countQuery = applyFilters(countQuery);
      const totalResult = await countQuery.count('id as count').first();
      total = parseInt(totalResult?.count || 0);
    } catch (countErr) {
      console.warn('[ListJobs] Count failed, defaulting to 0:', countErr.message);
    }

    // Select (Standalone query)
    let jobsQuery = db('comparison_jobs');
    jobsQuery = applyFilters(jobsQuery);
    const jobs = await jobsQuery
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const formattedJobs = jobs.map(j => ({
      id: j.id,
      tenantId: req.tenant?.id || 'MASTER',
      userId: j.user_id,
      status: j.status,
      referenceName: j.reference_name,
      candidateCount: j.candidate_count,
      createdAt: j.created_at,
      completedAt: j.completed_at,
      cost: parseFloat(j.cost),
      result: parseJsonResult(j.result),
      error: j.error_message,
      language: j.language
    }));

    res.json({ jobs: formattedJobs, total });
  } catch (error) {
    logger.error('jobs.list.error', { message: error.message }, error);
    res.status(500).json({ error: 'Erro ao listar jobs.', details: error.message });
  }
};

const crypto = require('crypto');

const jobProcessor = require('../services/jobProcessor');

const createJob = async (req, res) => {
  try {
    const db = req.db;
    // Log for debugging
    console.log('[CreateJob] Payload:', req.body);
    console.log('[CreateJob] User:', req.user);
    console.log('[CreateJob] Content-Type:', req.headers['content-type']);

    // Support JSON body or FormData fields
    let { referenceName, candidateCount, userId } = req.body;
    let { referenceText } = req.body;
    if (typeof referenceText !== 'string') {
      referenceText = '';
    }
    const language = normalizeLanguage(
      req?.tenant?.language || req?.tenant?.locale || req?.tenant?.lang || extractLanguageFromRequest(req),
    );

    // Fallback: If userId not in body, use authenticated user from token
    if (!userId && req.user && (req.user.userId || req.user.id)) {
      userId = req.user.userId || req.user.id;
    }

    if (!userId) {
      console.error('[CreateJob] Missing UserId. User:', req.user, 'Body:', req.body);
      throw new Error('UserId is required');
    }

    // Check if files were uploaded (via multer)
    const files = req.files || [];
    const candidateFilesCount = files.filter((file) => file?.fieldname === 'candidates').length;
    console.log(`[CreateJob] Received ${files.length} files`);

    if (!candidateCount && candidateFilesCount > 0) {
      candidateCount = candidateFilesCount;
    }

    // Verify user exists
    const userExists = await db('users').where({ id: userId }).first();

    // --- GOVERNANCE: CREDIT CHECK & COST CALCULATION ---
    // Calculate cost server-side to prevent tampering
    let globalConfig = {};
    try {
      const masterDb = connectionManager.getMaster();
      const row = await masterDb('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
      if (row?.value) {
        globalConfig = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      }
    } catch {
      // ignore config fetch errors
    }

    const finalCost = jobProcessor.calculateJobCost({
      candidateCount,
      fileCount: files.length || null,
      hasReference: Boolean(referenceName || files.find((f) => f?.fieldname === 'reference')),
      config: globalConfig
    });

    if (req.tenant) {
      const wallet = await billingService.getTenantWalletBalance(req.tenant);
      if (wallet.balance < finalCost) {
        return res.status(402).json({
          error: 'INSUFFICIENT_TOKENS',
          required: finalCost,
          balance: wallet.balance,
          details: `Saldo: ${wallet.balance} | Custo: ${finalCost}`
        });
      }
    }

    // Auto-provision shadow user if missing
    if (!userExists) {
      console.warn(`[Create Job] User ${userId} not found. Provisioning shadow user.`);
      try {
        await db('users').insert({
          id: userId,
          name: 'Shadow User',
          email: `shadow_${userId}@system.internal`,
          password: 'managed_externally',
          role: 'OWNER',
          status: 'ACTIVE',
          created_at: new Date()
        });
      } catch (insertError) { /* ignore */ }
    }

    const jobId = crypto.randomUUID();
    let uploadedFiles = [];
    try {
      uploadedFiles = await uploadFilesToStorage({
        files,
        tenant: req.tenant,
        jobId,
      });
    } catch (storageError) {
      logger.warn('jobs.create.storage_failed', { message: storageError.message, jobId });
    }

    const hasFilesColumn = await db.schema.hasColumn('comparison_jobs', 'files');
    const hasLanguageColumn = await db.schema.hasColumn('comparison_jobs', 'language');
    const filesForDbPayload = [...uploadedFiles];
    if (referenceText && !uploadedFiles.find((f) => f?.field === 'reference')) {
      filesForDbPayload.push({
        field: 'reference',
        originalName: referenceName || 'Referencia (texto)',
        mimeType: 'text/plain',
        size: referenceText.length,
        inlineText: referenceText
      });
    }
    const filesForDb = hasFilesColumn && filesForDbPayload.length > 0 ? JSON.stringify(filesForDbPayload) : null;

    const newJob = {
      id: jobId,
      user_id: userId,
      reference_name: referenceName || 'Nova Homologação',
      candidate_count: parseInt(candidateCount || 0),
      cost: finalCost, // Verified cost
      status: 'QUEUED', // Initial status
      created_at: new Date(),
      ...(filesForDb ? { files: filesForDb } : {}),
      ...(hasLanguageColumn && language ? { language } : {}),
    };

    // --- ATOMIC TRANSACTION START ---
    // 1. Reserve Credits
    if (req.tenant) {
      await billingService.reserveCredits(req.tenant.id, finalCost, jobId);
    }

    // 2. Insert Job
    await db('comparison_jobs').insert(newJob);
    // --- ATOMIC TRANSACTION END ---

    console.log('[Create Job] Success, ID:', jobId);
    await logAudit(req, 'JOB_CREATE', 'comparison_jobs', `id=${jobId}`);

    // --- TRIGGER PROCESSING IN BACKGROUND ---
    jobProcessor.processJob(jobId, req.tenant).catch(err => {
      logger.error('Background Job Processing Failed', { jobId, error: err.message });
    });

    res.json({
      id: jobId,
      status: 'QUEUED',
      ...newJob
    });
  } catch (error) {
    logger.error('jobs.create.error', { message: error.message }, error);
    res.status(500).json({
      error: 'Erro ao criar job.',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const updateJob = async (req, res) => {
  try {
    const db = req.db;
    const { id } = req.params;
    const { status, result, error, prices } = req.body;

    const existingJob = await db('comparison_jobs').where({ id }).first();
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const previousStatus = existingJob.status;
    const updateData = {};
    if (status) updateData.status = status;
    if (result) {
      const parsed = typeof result === 'string' ? parseJsonResult(result) : result;
      updateData.result = applyPricesToResult(parsed, prices);
    } else if (prices) {
      const parsedExisting = parseJsonResult(existingJob.result);
      updateData.result = applyPricesToResult(parsedExisting, prices);
    }
    if (error) updateData.error_message = error;
    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completed_at = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    const updated = await db('comparison_jobs').where({ id }).update(updateData);
    if (!updated) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (status && status !== previousStatus) {
      try {
        if (status === 'FAILED') {
          await billingService.refundCredits(id);
        } else if (status === 'COMPLETED') {
          await billingService.captureCredits(id);
        }
      } catch (billingError) {
        logger.error('jobs.update.billing_error', { message: billingError.message, jobId: id }, billingError);
        return res.status(500).json({ error: 'Erro ao atualizar cobrança do job.' });
      }
    }
    await logAudit(req, 'JOB_UPDATE', 'comparison_jobs', `id=${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('jobs.update.error', { message: error.message }, error);
    res.status(500).json({ error: 'Erro ao atualizar job.' });
  }
};

const getJob = async (req, res) => {
  try {
    const db = req.db;
    const job = await db('comparison_jobs').where({ id: req.params.id }).first();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.json({
      id: job.id,
      status: job.status,
      result: parseJsonResult(job.result),
      error: job.error_message,
      referenceName: job.reference_name,
      language: job.language
    });
  } catch (e) {
    logger.error('jobs.get.error', { message: e.message }, e);
    res.status(500).json({ error: e.message });
  }
}

const getJobReportPdf = async (req, res) => {
  try {
    const db = req.db;
    const job = await db('comparison_jobs').where({ id: req.params.id }).first();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (job.status !== 'COMPLETED') {
      return res.status(409).json({ error: 'Job not completed' });
    }

    const parsedResult = parseJsonResult(job.result);
    const normalized = reportPdfService.normalizeComparisonResult(parsedResult, job.reference_name);
    const showDiffOnly = req.query.diff === '1' || req.query.showDiffOnly === 'true';

    let brandingLogoUrl = '';
    try {
      const masterDb = connectionManager.getMaster();
      const row = await masterDb('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
      if (row?.value) {
        const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        brandingLogoUrl =
          parsed?.branding?.logoUrl ||
          parsed?.branding?.logo_url ||
          parsed?.logoUrl ||
          parsed?.logo_url ||
          '';
      }
    } catch {
      // ignore branding fetch errors
    }

    const masterDb = connectionManager.getMaster();
    const tenantRow = await masterDb('tenants').where({ id: req.tenant.id }).first();
    const resolvedTenant = tenantRow || req.tenant;
    const jobLanguage = normalizeLanguage(job.language || resolvedTenant?.language || resolvedTenant?.locale || resolvedTenant?.lang);

    const pdfBuffer = await reportPdfService.generateReportPdf({
      data: normalized,
      tenant: resolvedTenant,
      showDiffOnly,
      reportCode: job.id,
      brandingLogoUrl,
      language: jobLanguage,
    });

    const safeName = sanitizeFilename(job.reference_name || 'Relatorio_Tecnico');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Relatorio_Tecnico_${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    logger.error('jobs.report.pdf.error', { message: e.message }, e);
    res.status(500).json({ error: 'Erro ao gerar PDF.', details: e.message });
  }
};

const deleteJob = async (req, res) => {
  try {
    const db = req.db;
    await db('comparison_jobs').where({ id: req.params.id }).del();
    await logAudit(req, 'JOB_DELETE', 'comparison_jobs', `id=${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    logger.error('jobs.delete.error', { message: e.message }, e);
    res.status(500).json({ error: e.message });
  }
}

module.exports = { listJobs, createJob, updateJob, getJob, deleteJob, getJobReportPdf };

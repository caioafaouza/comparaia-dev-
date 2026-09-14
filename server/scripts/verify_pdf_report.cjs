const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');
const connectionManager = require('../db/connectionManager');
const reportPdfService = require('../services/reportPdfService');

const log = (msg, meta = {}) => {
  const time = new Date().toISOString();
  console.log(`[verify_pdf_report] ${time} ${msg}`, meta);
};

const main = async () => {
  const start = Date.now();
  const masterDb = connectionManager.getMaster();

  const tenantSlug = process.env.TENANT_SLUG;
  const tenantId = process.env.TENANT_ID;

  let tenant = null;
  if (tenantId || tenantSlug) {
    tenant = await masterDb('tenants').where(tenantId ? { id: tenantId } : { slug: tenantSlug }).first();
  }
  if (!tenant) {
    tenant = await masterDb('tenants').orderBy('created_at', 'desc').first();
  }
  if (!tenant) {
    throw new Error('Nenhum tenant encontrado para gerar PDF.');
  }

  const tenantDb = connectionManager.getTenantConnection(tenant);
  let jobId = process.env.JOB_ID;
  if (!jobId) {
    const latest = await tenantDb('comparison_jobs').where({ status: 'COMPLETED' }).orderBy('created_at', 'desc').first();
    jobId = latest?.id;
  }
  if (!jobId) {
    throw new Error('Nenhum job COMPLETED encontrado para gerar PDF.');
  }

  const job = await tenantDb('comparison_jobs').where({ id: jobId }).first();
  if (!job) {
    throw new Error('Job não encontrado.');
  }

  let rawResult = job.result;
  if (typeof rawResult === 'string') {
    try {
      rawResult = JSON.parse(rawResult);
    } catch {
      // keep as string
    }
  }
  const result = reportPdfService.normalizeComparisonResult(rawResult, job.reference_name);
  const pdfBuffer = await reportPdfService.generateReportPdf({
    data: result,
    tenant,
    showDiffOnly: false,
  });

  const outPath = path.join(__dirname, '_verify_report.pdf');
  await fs.writeFile(outPath, pdfBuffer);
  const stats = await fs.stat(outPath);

  if (stats.size < 50 * 1024) {
    throw new Error(`PDF muito pequeno (${stats.size} bytes).`);
  }

  const parsed = await pdfParse(pdfBuffer);
  const text = (parsed.text || '').toLowerCase();
  const requiredTerms = ['matriz técnica'];
  const optionalTerms = ['não consta no documento', 'desvio crítico', 'não informado', 'vencedor', 'candidato'];

  const missingRequired = requiredTerms.filter((term) => !text.includes(term));
  if (missingRequired.length) {
    throw new Error(`Termos obrigatórios não encontrados no PDF: ${missingRequired.join(', ')}`);
  }

  const hasOptional = optionalTerms.some((term) => text.includes(term));
  if (!hasOptional) {
    throw new Error(`Nenhum termo opcional encontrado no PDF. Esperado um de: ${optionalTerms.join(', ')}`);
  }

  log('OK', {
    jobId,
    tenantId: tenant.id,
    pages: parsed.numpages,
    size: stats.size,
    durationMs: Date.now() - start,
    output: outPath,
  });
};

main().catch((err) => {
  console.error('[verify_pdf_report] FAILED', err.message);
  process.exit(1);
});

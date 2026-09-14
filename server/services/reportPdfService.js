const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const sharedBrowsersPath = path.resolve(__dirname, '..', '..', '.cache', 'ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(sharedBrowsersPath)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = sharedBrowsersPath;
}

const { chromium } = require('playwright-chromium');

const getChromiumExecutableCandidates = () => {
  const configured = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
  ].filter(Boolean);

  if (process.platform === 'win32') {
    configured.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (process.platform === 'linux') {
    configured.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  } else if (process.platform === 'darwin') {
    configured.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  }

  return [...new Set(configured)];
};

const resolveChromiumExecutablePath = () => {
  const candidates = getChromiumExecutableCandidates();
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
};

const isPermissionLaunchError = (error) => {
  const msg = String(error?.message || '');
  return /EPERM|EACCES|permission denied/i.test(msg);
};

const launchChromiumWithFallback = async () => {
  const baseArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  const existingCandidates = getChromiumExecutableCandidates().filter((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });

  const attempts = [];
  existingCandidates.forEach((candidate) => {
    attempts.push({ executablePath: candidate, args: baseArgs });
  });
  // Final fallback: let Playwright use managed browser
  attempts.push({ args: baseArgs });

  let lastError = null;
  for (const attempt of attempts) {
    const launchOptions = { headless: true, ...attempt };
    try {
      const browser = await chromium.launch(launchOptions);
      logger.info('report.pdf.launch', {
        executablePath: launchOptions.executablePath || 'playwright-managed',
        browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || 'default',
        platform: process.platform,
      });
      return browser;
    } catch (error) {
      lastError = error;

      // If Linux permission issue on explicit executable, try to fix and retry once.
      if (attempt.executablePath && process.platform === 'linux' && isPermissionLaunchError(error)) {
        try {
          fs.chmodSync(attempt.executablePath, 0o755);
          const browser = await chromium.launch(launchOptions);
          logger.info('report.pdf.launch', {
            executablePath: launchOptions.executablePath || 'playwright-managed',
            browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || 'default',
            platform: process.platform,
            chmodApplied: true,
          });
          return browser;
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  logger.error(
    'report.pdf.launch_error',
    {
      message: lastError?.message || 'Unknown launch error',
      executablePath: resolveChromiumExecutablePath(),
      browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || null,
      hint:
        'Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH/CHROME_BIN to a valid executable or run: npx playwright install chromium',
    },
    lastError
  );
  throw lastError;
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const escapeHtmlMultiline = (value) => {
  return escapeHtml(value).replace(/\r?\n/g, '<br/>');
};

const normalizeComparisonResult = (raw, referenceNameFallback = 'Referência') => {
  if (!raw) {
    return { referenceName: referenceNameFallback, candidates: [], executiveSummary: '' };
  }

  if (raw?.candidates && Array.isArray(raw.candidates)) {
    return {
      referenceName: raw.referenceName || referenceNameFallback,
      candidates: raw.candidates || [],
      executiveSummary: raw.executiveSummary || '',
      shareToken: raw.shareToken,
      priceMap: raw.priceMap || raw.price_map,
    };
  }

  if (raw?.CandidateProduct && Array.isArray(raw.CandidateProduct)) {
    const newCandidates = raw.CandidateProduct.map((legacyCand) => {
      const attributes = [];
      if (legacyCand.Specification) {
        for (const [key, val] of Object.entries(legacyCand.Specification)) {
          attributes.push({
            name: key,
            candidateValue: String(val),
            referenceValue: 'N/A',
            matchScore: 0.5,
            requiresVerification: false,
            confidenceScore: 0.8,
          });
        }
      }
      if (raw.Comparison && Array.isArray(raw.Comparison)) {
        raw.Comparison.forEach((comp) => {
          if (comp.Candidate === legacyCand.Candidate || raw.CandidateProduct.length === 1) {
            const existingAttr = attributes.find((a) => a.name === comp.Characteristic);
            if (existingAttr) {
              existingAttr.referenceValue = comp.Reference;
              existingAttr.candidateValue = comp.Candidate;
              existingAttr.matchScore = comp.Match ? 1 : 0;
            } else {
              attributes.push({
                name: comp.Characteristic,
                referenceValue: comp.Reference,
                candidateValue: comp.Candidate,
                matchScore: comp.Match ? 1 : 0,
                requiresVerification: !comp.Match,
                confidenceScore: 1,
              });
            }
          }
        });
      }
      return {
        productName: legacyCand.Candidate || 'Produto Candidato',
        isRecommended: false,
        totalScore: 0.5,
        pros: [],
        cons: [],
        attributes,
        reasoning: 'Dados migrados de versão anterior.',
        price: 0,
      };
    });
    return {
      referenceName: raw.ReferenceProduct?.Reference || referenceNameFallback,
      candidates: newCandidates,
      executiveSummary: 'Relatório adaptado do formato antigo.',
    };
  }

  return { referenceName: referenceNameFallback, candidates: [], executiveSummary: '' };
};

const normalizeLanguage = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'pt';
  if (raw.startsWith('pt')) return 'pt';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('es')) return 'es';
  return 'pt';
};

const REPORT_LABELS = {
  pt: {
    reportTitle: 'Relatório de Homologação Técnica',
    reportSubtitle: '',
    diffOnlySuffix: '(Modo: Apenas Diferenças)',
    referenceItem: 'Item de Referência',
    executiveSummary: 'Resumo Executivo',
    summaryMissing: 'Resumo executivo n\u00e3o informado.',
    projectCode: 'Código do Projeto',
    reportCode: 'Código',
    statusLegend: 'Legenda de Status',
    bestChoice: 'Melhor Escolha Técnica',
    adherenceScore: 'Score de Aderência',
    costBenefitTitle: 'Matriz de Decisão: Custo x Benefício',
    costBenefitEmpty:
      'Nenhum candidato possui valor informado. Para habilitar a matriz, preencha os preços no painel de simulação.',
    costLegendTitle: 'Legenda & Métricas',
    costLegendFoot: 'ROI = pontos por R$ 1.000 investidos.',
    costScoreLabel: 'Score (%)',
    costInvestmentLabel: 'Investimento (R$)',
    matrixTitle: '1. Matriz Técnica Detalhada',
    matrixParam: 'Parâmetro (Referência)',
    matrixSpec: 'Especificação Exigida',
    winnerLabel: '(VENCEDOR)',
    candidateLabel: '(CANDIDATO)',
    financialEvaluation: 'Avaliação Financeira',
    estimatedValues: 'Valores Estimados / ROI',
    notApplicable: 'N/A',
    missingDoc: '— Não consta no documento —',
    criticalDeviation: '⚠ Desvio Crítico',
    technicalReview: '2. Parecer Técnico Individual',
    strengths: 'Pontos Fortes',
    attention: 'Pontos de Atenção',
    footer: '',
    pageLabel: 'Página',
    pageSeparator: 'de',
    tableHeaders: { id: '#', candidate: 'Candidato', price: 'Preço', score: 'Score', roi: 'ROI' },
    status: {
      ATENDE: { label: 'Atende', legend: 'Requisito comprovado no candidato.' },
      PARCIAL: { label: 'Parcial', legend: 'Atende com restrições ou condições.' },
      NAO_ATENDE: { label: 'Não atende', legend: 'Incompatível com o requisito.' },
      NAO_INFORMADO: { label: 'Não informado', legend: 'Sem evidência no documento.' },
    },
  },
  en: {
    reportTitle: 'Technical Homologation Report',
    reportSubtitle: '',
    diffOnlySuffix: '(Mode: Differences Only)',
    referenceItem: 'Reference Item',
    executiveSummary: 'Executive Summary',
    summaryMissing: 'Executive summary not informed.',
    projectCode: 'Project Code',
    reportCode: 'Code',
    statusLegend: 'Status Legend',
    bestChoice: 'Best Technical Choice',
    adherenceScore: 'Adherence Score',
    costBenefitTitle: 'Decision Matrix: Cost vs Benefit',
    costBenefitEmpty:
      'No candidate has a price informed. To enable the matrix, fill prices in the simulation panel.',
    costLegendTitle: 'Legend & Metrics',
    costLegendFoot: 'ROI = points per R$ 1,000 invested.',
    costScoreLabel: 'Score (%)',
    costInvestmentLabel: 'Investment (R$)',
    matrixTitle: '1. Detailed Technical Matrix',
    matrixParam: 'Parameter (Reference)',
    matrixSpec: 'Required Specification',
    winnerLabel: '(WINNER)',
    candidateLabel: '(CANDIDATE)',
    financialEvaluation: 'Financial Evaluation',
    estimatedValues: 'Estimated Values / ROI',
    notApplicable: 'N/A',
    missingDoc: '— Not found in document —',
    criticalDeviation: '⚠ Critical Deviation',
    technicalReview: '2. Individual Technical Review',
    strengths: 'Strengths',
    attention: 'Attention Points',
    footer: '',
    pageLabel: 'Page',
    pageSeparator: 'of',
    tableHeaders: { id: '#', candidate: 'Candidate', price: 'Price', score: 'Score', roi: 'ROI' },
    status: {
      ATENDE: { label: 'Meets', legend: 'Requirement supported by evidence in the candidate.' },
      PARCIAL: { label: 'Partial', legend: 'Meets with restrictions or conditions.' },
      NAO_ATENDE: { label: 'Does not meet', legend: 'Incompatible with the requirement.' },
      NAO_INFORMADO: { label: 'Not informed', legend: 'No evidence in the document.' },
    },
  },
  es: {
    reportTitle: 'Informe de Homologación Técnica',
    reportSubtitle: '',
    diffOnlySuffix: '(Modo: Solo diferencias)',
    referenceItem: 'Ítem de Referencia',
    executiveSummary: 'Resumen Ejecutivo',
    summaryMissing: 'Resumen ejecutivo no informado.',
    projectCode: 'Código del Proyecto',
    reportCode: 'Código',
    statusLegend: 'Leyenda de Estados',
    bestChoice: 'Mejor Elección Técnica',
    adherenceScore: 'Puntaje de Adhesión',
    costBenefitTitle: 'Matriz de Decisión: Costo vs Beneficio',
    costBenefitEmpty:
      'Ningún candidato tiene valor informado. Para habilitar la matriz, complete los precios en el panel de simulación.',
    costLegendTitle: 'Leyenda y Métricas',
    costLegendFoot: 'ROI = puntos por R$ 1.000 invertidos.',
    costScoreLabel: 'Puntaje (%)',
    costInvestmentLabel: 'Inversión (R$)',
    matrixTitle: '1. Matriz Técnica Detallada',
    matrixParam: 'Parámetro (Referencia)',
    matrixSpec: 'Especificación Requerida',
    winnerLabel: '(GANADOR)',
    candidateLabel: '(CANDIDATO)',
    financialEvaluation: 'Evaluación Financiera',
    estimatedValues: 'Valores Estimados / ROI',
    notApplicable: 'N/A',
    missingDoc: '— No consta en el documento —',
    criticalDeviation: '⚠ Desvío Crítico',
    technicalReview: '2. Dictamen Técnico Individual',
    strengths: 'Puntos Fuertes',
    attention: 'Puntos de Atención',
    footer: '',
    pageLabel: 'Página',
    pageSeparator: 'de',
    tableHeaders: { id: '#', candidate: 'Candidato', price: 'Precio', score: 'Puntaje', roi: 'ROI' },
    status: {
      ATENDE: { label: 'Cumple', legend: 'Requisito comprobado en el candidato.' },
      PARCIAL: { label: 'Parcial', legend: 'Cumple con restricciones o condiciones.' },
      NAO_ATENDE: { label: 'No cumple', legend: 'Incompatible con el requisito.' },
      NAO_INFORMADO: { label: 'No informado', legend: 'Sin evidencia en el documento.' },
    },
  },
};

const getLabels = (language) => REPORT_LABELS[language] || REPORT_LABELS.pt;
const getLocale = (language) => {
  if (language === 'en') return 'en-US';
  if (language === 'es') return 'es-ES';
  return 'pt-BR';
};

const resolveLogoUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value)) return value;
  const base =
    process.env.BACKEND_URL ||
    process.env.BASE_URL ||
    process.env.API_URL ||
    '';
  if (!base) return value;
  return `${base.replace(/\/$/, '')}/${String(value).replace(/^\/+/, '')}`;
};

const getDefaultPlatformLogoDataUri = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="260" height="64" viewBox="0 0 260 64">
      <rect width="260" height="64" rx="8" fill="#ffffff"/>
      <g transform="translate(10 10)">
        <rect x="0" y="6" width="18" height="18" rx="5" transform="rotate(-35 9 15)" fill="#ff6a3d"/>
        <rect x="13" y="6" width="18" height="18" rx="5" transform="rotate(-35 22 15)" fill="#38bdf8"/>
        <rect x="26" y="6" width="18" height="18" rx="5" transform="rotate(-35 35 15)" fill="#6366f1"/>
      </g>
      <text x="70" y="29" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#0f172a">COMPARA</text>
      <text x="70" y="47" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#10b981">IA</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
};

const buildReportHtml = (data, tenant, { showDiffOnly = false, reportCode, brandingLogoUrl, language } = {}) => {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const normalizeKey = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  const priceMap = data.priceMap && typeof data.priceMap === 'object' ? data.priceMap : {};
  const candidatesWithPrices = candidates.map((cand) => {
    if (cand?.price && Number(cand.price) > 0) return cand;
    const key = normalizeKey(cand?.productName || cand?.name || '');
    if (!key || priceMap[key] === undefined) return cand;
    return { ...cand, price: priceMap[key] };
  });
  const sortedCandidates = [...candidatesWithPrices].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  const winner = sortedCandidates[0];
  const hasPrices = sortedCandidates.some((c) => c.price && c.price > 0);
  const lang = normalizeLanguage(language || tenant?.language || tenant?.locale || tenant?.lang);
  const labels = getLabels(lang);
  const locale = getLocale(lang);
  const tenantLogo = tenant?.logoUrl || tenant?.logo_url || '';
  const platformLogo = brandingLogoUrl || '';
  const logoUrl = resolveLogoUrl(tenantLogo || platformLogo || '') || getDefaultPlatformLogoDataUri();
  const auditCode = reportCode || data.shareToken || '';
  const now = new Date();
  const dateLabel = now.toLocaleDateString(locale);
  const dateTimeLabel = now.toLocaleString(locale);

  const truncate = (value, max = 38) => {
    const text = String(value || '');
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  };

  const normalizeText = (value) =>
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const isMissingValue = (rawValue) => {
    const normalized = normalizeText(rawValue);
    if (!normalized) return true;
    const missingTokens = [
      'nao informado',
      'nao consta',
      'nao especificado',
      'not informed',
      'not found',
      'not provided',
      'no informado',
      'no consta',
      'no especificado',
      'n/a',
    ];
    return missingTokens.some((token) => normalized.includes(token));
  };

  const STATUS_CONFIG = {
    ATENDE: {
      label: labels.status.ATENDE.label,
      className: 'status-ok',
      letter: 'A',
      legend: labels.status.ATENDE.legend,
    },
    PARCIAL: {
      label: labels.status.PARCIAL.label,
      className: 'status-warn',
      letter: 'P',
      legend: labels.status.PARCIAL.legend,
    },
    NAO_ATENDE: {
      label: labels.status.NAO_ATENDE.label,
      className: 'status-bad',
      letter: 'N',
      legend: labels.status.NAO_ATENDE.legend,
    },
    NAO_INFORMADO: {
      label: labels.status.NAO_INFORMADO.label,
      className: 'status-muted',
      letter: '?',
      legend: labels.status.NAO_INFORMADO.legend,
    },
  };

  const normalizeScore = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return num <= 1 ? num * 100 : num;
  };

  const resolveAttributeStatus = (attr) => {
    const rawValue = String(attr?.candidateValue || '').trim();
    if (isMissingValue(rawValue)) return 'NAO_INFORMADO';

    const explicitRaw = normalizeText(attr?.status || attr?.matchStatus || '');
    if (explicitRaw) {
      if (explicitRaw.includes('parcial')) return 'PARCIAL';
      if (
        explicitRaw.includes('nao atende') ||
        explicitRaw.includes('no cumple') ||
        explicitRaw.includes('does not meet') ||
        explicitRaw.includes('not meet')
      ) {
        return 'NAO_ATENDE';
      }
      if (explicitRaw.includes('atende') || explicitRaw.includes('cumple') || explicitRaw.includes('meets')) {
        return 'ATENDE';
      }
    }

    const score = normalizeScore(attr?.matchScore);
    if (score === null) return attr?.requiresVerification ? 'PARCIAL' : 'ATENDE';
    if (score >= 80) return 'ATENDE';
    if (score >= 40) return 'PARCIAL';
    return 'NAO_ATENDE';
  };

  const renderStatusBadge = (statusKey) => {
    const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.PARCIAL;
    return `
      <div class="status-badge">
        <span class="status-dot ${cfg.className}">${cfg.letter}</span>
        <span class="status-text">${cfg.label}</span>
      </div>
    `;
  };

  const renderLegend = () => `
    <div class="legend">
      <div class="legend-title">${labels.statusLegend}</div>
      <div class="legend-items">
        ${Object.keys(STATUS_CONFIG)
          .map((key) => {
            const cfg = STATUS_CONFIG[key];
            return `
              <div class="legend-item">
                <span class="status-dot ${cfg.className}">${cfg.letter}</span>
                <span class="legend-text"><strong>${cfg.label}</strong> — ${cfg.legend}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  const isRowDifferent = (attrName) => {
    if (sortedCandidates.length < 2) return true;
    const values = sortedCandidates.map((c) => {
      const val = c.attributes?.find((a) => a.name === attrName)?.candidateValue;
      return val ? val.trim().toLowerCase() : '';
    });
    const firstVal = values[0];
    return !values.every((v) => v === firstVal);
  };

  let allAttributeNames = Array.from(
    new Set(sortedCandidates.flatMap((c) => (c.attributes || []).map((a) => a.name))),
  );
  if (showDiffOnly) {
    allAttributeNames = allAttributeNames.filter((name) => isRowDifferent(name));
  }

  const renderHeader = () => `
    <div class="header">
      <div class="header-left">
        <div class="logo">
          ${logoUrl ? `<img class="logo-img" src="${escapeHtml(logoUrl)}" alt="Logo" />` : ''}
        </div>
        <div>
        <div class="title">${labels.reportTitle}</div>
        ${labels.reportSubtitle
          ? `<div class="subtitle">${labels.reportSubtitle}${showDiffOnly ? ` ${labels.diffOnlySuffix}` : ''}</div>`
          : showDiffOnly
            ? `<div class="subtitle">${labels.diffOnlySuffix}</div>`
            : ''}
        </div>
      </div>
      <div class="header-right">
        <div class="tenant">${escapeHtml(tenant?.name || 'Organização')}</div>
        ${auditCode ? `<div class="report-code">${labels.reportCode}: ${escapeHtml(auditCode)}</div>` : ''}
        <div class="date">${escapeHtml(dateTimeLabel)}</div>
      </div>
    </div>
  `;

  const splitSummary = (summaryText) => {
    const cleaned = (summaryText || '')
      .replace(/^"+|"+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];
    let parts = cleaned.split(/(?<=[.!?])\s+|;\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1 && parts[0].length > 220) {
      parts = parts[0].split(/,\s+/).map((p) => p.trim()).filter(Boolean);
    }
    return parts.slice(0, 6);
  };

  const renderSummary = () => {
    const summaryItems = splitSummary(data.executiveSummary || '');
    const fallback = data.executiveSummary ? escapeHtml(data.executiveSummary) : labels.summaryMissing;
    return `
      <div class="summary">
        <div class="summary-head">
          <div>
            <div class="summary-label">${labels.referenceItem}</div>
            <div class="summary-title">${escapeHtml(data.referenceName || labels.referenceItem)}</div>
          </div>
          <div class="summary-chip">${labels.executiveSummary}</div>
        </div>
        ${auditCode ? `<div class="summary-meta">${labels.projectCode}: ${escapeHtml(auditCode)}</div>` : ''}
        <div class="summary-body">
          ${
            summaryItems.length
              ? `<ul class="summary-list">${summaryItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
              : `<div class="summary-text">${fallback}</div>`
          }
        </div>
      </div>
    `;
  };

  const renderWinner = () => {
    if (!winner) return '';
    return `
      <div class="winner">
        <div>
          <div class="winner-label">${labels.bestChoice}</div>
          <div class="winner-name">${escapeHtml(winner.productName || '')}</div>
        </div>
        <div class="winner-score">
          <div class="winner-score-value">${Math.round((winner.totalScore || 0) * (winner.totalScore <= 1 ? 100 : 1))}%</div>
          <div class="winner-score-label">${labels.adherenceScore}</div>
        </div>
      </div>
    `;
  };

  const renderCostBenefit = () => {
    if (!sortedCandidates.length) return '';
    if (!hasPrices) {
      return `
        <div class="section-block avoid-break">
          <div class="section-title">${labels.costBenefitTitle}</div>
          <div class="cost-benefit">
            <div class="cost-note">${labels.costBenefitEmpty}</div>
          </div>
        </div>
      `;
    }

    const points = sortedCandidates.map((c, idx) => {
      const score = normalizeScore(c.totalScore) || 0;
      const price = Number(c.price || 0);
      return {
        index: idx + 1,
        name: c.productName || `Candidato ${idx + 1}`,
        price,
        score,
        roi: price > 0 ? (score / (price / 1000)).toFixed(1) : '0',
      };
    });

    const prices = points.map((p) => p.price).filter((p) => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const plot = {
      width: 520,
      height: 200,
      marginLeft: 40,
      marginTop: 20,
      marginBottom: 30,
      marginRight: 20,
    };
    const plotWidth = plot.width - plot.marginLeft - plot.marginRight;
    const plotHeight = plot.height - plot.marginTop - plot.marginBottom;

    const circles = points
      .filter((p) => p.price > 0)
      .map((p) => {
        const x = plot.marginLeft + ((p.price - minPrice) / priceRange) * plotWidth;
        const y = plot.marginTop + (1 - p.score / 100) * plotHeight;
        const isBest = p.index === 1;
        return `
          <g>
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${isBest ? '#16a34a' : '#2563eb'}"></circle>
            <text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" font-size="9" fill="#0f172a">${p.index}</text>
          </g>
        `;
      })
      .join('');

    const legendRows = points
      .map(
        (p) => `
        <tr>
          <td class="legend-id">${p.index}</td>
          <td>${escapeHtml(truncate(p.name, 42))}</td>
          <td>R$ ${Number(p.price || 0).toLocaleString(locale)}</td>
          <td>${Math.round(p.score)}%</td>
          <td>${p.roi}</td>
        </tr>
      `,
      )
      .join('');

    return `
      <div class="section-block avoid-break">
        <div class="section-title">${labels.costBenefitTitle}</div>
        <div class="cost-benefit">
          <div class="cost-grid">
            <div class="cost-chart">
              <svg viewBox="0 0 ${plot.width} ${plot.height}" width="100%" height="220" aria-label="${labels.costBenefitTitle}">
                <rect x="0" y="0" width="${plot.width}" height="${plot.height}" fill="#ffffff" stroke="#e2e8f0"></rect>
                <line x1="${plot.marginLeft}" y1="${plot.marginTop}" x2="${plot.marginLeft}" y2="${plot.marginTop + plotHeight}" stroke="#94a3b8" stroke-width="1"></line>
                <line x1="${plot.marginLeft}" y1="${plot.marginTop + plotHeight}" x2="${plot.marginLeft + plotWidth}" y2="${plot.marginTop + plotHeight}" stroke="#94a3b8" stroke-width="1"></line>
                <text x="8" y="${plot.marginTop - 4}" font-size="8" fill="#64748b">${labels.costScoreLabel}</text>
                <text x="${plot.marginLeft + plotWidth - 70}" y="${plot.marginTop + plotHeight + 22}" font-size="8" fill="#64748b">${labels.costInvestmentLabel}</text>
                ${circles}
              </svg>
            </div>
            <div class="cost-legend">
              <div class="cost-legend-title">${labels.costLegendTitle}</div>
              <table class="cost-table">
                <thead>
                  <tr>
                    <th>${labels.tableHeaders.id}</th>
                    <th>${labels.tableHeaders.candidate}</th>
                    <th>${labels.tableHeaders.price}</th>
                    <th>${labels.tableHeaders.score}</th>
                    <th>${labels.tableHeaders.roi}</th>
                  </tr>
                </thead>
                <tbody>
                  ${legendRows}
                </tbody>
              </table>
              <div class="cost-legend-foot">${labels.costLegendFoot}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderTable = () => {
    if (!sortedCandidates.length) return '';
    const headerCols = sortedCandidates
      .map(
        (c, i) => `
        <th>
          ${escapeHtml(c.productName || '')}
          <div class="col-meta">${i === 0 ? labels.winnerLabel : labels.candidateLabel}</div>
        </th>
      `,
      )
      .join('');

    const priceRow = hasPrices
      ? `
      <tr class="avoid-break price-row">
        <td class="price-label">${labels.financialEvaluation}</td>
        <td class="price-sub">${labels.estimatedValues}</td>
        ${sortedCandidates
          .map((c) => {
            const price = c.price || 0;
            const score = c.totalScore || 0;
            const normalizedScore = score <= 1 ? score * 100 : score;
            const roi = price > 0 ? (normalizedScore / (price / 1000)).toFixed(1) : 0;
            return `
              <td class="price-cell">
                <div class="price-value">${price > 0 ? `R$ ${Number(price).toLocaleString(locale)}` : labels.notApplicable}</div>
                ${price > 0 ? `<div class="price-roi">ROI: ${roi} pts/kR$</div>` : ''}
              </td>
            `;
          })
          .join('')}
      </tr>
    `
      : '';

    const rows = allAttributeNames
      .map((attrName) => {
        const refValue =
          sortedCandidates[0].attributes?.find((a) => a.name === attrName)?.referenceValue || labels.notApplicable;
        const cells = sortedCandidates
          .map((cand) => {
            const attr = cand.attributes?.find((a) => a.name === attrName);
            const isCritical = !!attr?.requiresVerification;
            const rawValue = attr?.candidateValue || '';
            const isMissing = isMissingValue(rawValue);
            const statusKey = resolveAttributeStatus(attr);
            return `
              <td class="${isCritical ? 'critical' : ''}">
                ${renderStatusBadge(statusKey)}
                ${
                  isMissing
                    ? `<span class="missing">${escapeHtml(labels.missingDoc)}</span>`
                    : `<span class="multiline">${escapeHtmlMultiline(rawValue)}</span>`
                }
                ${isCritical ? `<div class="critical-note">${labels.criticalDeviation}</div>` : ''}
              </td>
            `;
          })
          .join('');
        return `
          <tr class="matrix-row">
            <td class="attr-name">${escapeHtml(attrName)}</td>
            <td class="attr-ref"><span class="multiline">${escapeHtmlMultiline(refValue)}</span></td>
            ${cells}
          </tr>
        `;
      })
      .join('');

    return `
      <div class="section-block matrix-block">
        <div class="section-title">${labels.matrixTitle}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 20%">${labels.matrixParam}</th>
              <th style="width: 25%">${labels.matrixSpec}</th>
              ${headerCols}
            </tr>
          </thead>
          <tbody>
            ${priceRow}
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderCards = () => {
    if (!sortedCandidates.length) return '';
    const cards = sortedCandidates
      .map((c) => {
        const score = c.totalScore || 0;
        const normalizedScore = score <= 1 ? score * 100 : score;
        return `
          <div class="card">
            <div class="card-header">
              <div class="card-title">${escapeHtml(c.productName || '')}</div>
              <div class="card-score">${Math.round(normalizedScore)}%</div>
            </div>
            <div class="card-reason multiline">"${escapeHtmlMultiline(c.reasoning || '')}"</div>
            <div class="card-block">
              <div class="card-block-title">${labels.strengths}</div>
              <ul>
                ${(c.pros || []).slice(0, 4).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
              </ul>
            </div>
            ${
              c.cons && c.cons.length
                ? `<div class="card-block">
                     <div class="card-block-title warn">${labels.attention}</div>
                     <ul>${c.cons.slice(0, 4).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
                   </div>`
                : ''
            }
          </div>
        `;
      })
      .join('');
    return `
      <div class="section-block avoid-break">
        <div class="section-title">${labels.technicalReview}</div>
        <div class="cards">${cards}</div>
      </div>
    `;
  };

  return `<!doctype html>
  <html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>${labels.reportTitle}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 10pt; }
      * { box-sizing: border-box; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; word-break: break-word; white-space: normal; }
      .multiline { white-space: pre-line; word-break: break-word; }
      th { background: #f1f5f9; text-transform: uppercase; font-size: 8pt; font-weight: 800; }
      tr:nth-child(even) td { background: #f8fafc; }
      tr, td, th { break-inside: avoid; page-break-inside: avoid; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
      .header-left { display: flex; gap: 12px; align-items: center; }
      .logo { font-weight: 900; font-size: 14pt; }
      .logo-text { font-weight: 900; font-size: 14pt; letter-spacing: 0.04em; }
      .logo-img { max-height: 40px; max-width: 180px; object-fit: contain; display: block; }
      .title { font-size: 16pt; font-weight: 900; text-transform: uppercase; }
      .subtitle { font-size: 8pt; color: #64748b; }
      .tenant { font-weight: 700; font-size: 10pt; text-align: right; }
      .report-code { font-size: 8pt; color: #0f172a; text-align: right; font-weight: 700; margin-top: 2px; }
      .date { font-size: 8pt; color: #64748b; text-align: right; }
      .summary { border: 1px solid #e2e8f0; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
      .summary-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
      .summary-label { font-size: 9pt; color: #64748b; text-transform: uppercase; font-weight: 700; }
      .summary-title { font-size: 14pt; font-weight: 900; margin-top: 4px; }
      .summary-chip { background: #0f172a; color: #fff; border-radius: 999px; padding: 4px 10px; font-size: 7pt; text-transform: uppercase; font-weight: 800; letter-spacing: 0.08em; }
      .summary-meta { margin-top: 6px; font-size: 8pt; font-weight: 700; color: #0f172a; }
      .summary-body { margin-top: 8px; }
      .summary-list { margin: 0; padding-left: 18px; color: #334155; line-height: 1.4; }
      .summary-list li { margin-bottom: 4px; }
      .summary-text { font-style: italic; color: #334155; border-left: 4px solid #94a3b8; padding-left: 8px; margin-top: 6px; line-height: 1.4; }
      .legend { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; background: #ffffff; }
      .legend-title { font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; }
      .legend-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; }
      .legend-item { display: flex; align-items: center; gap: 6px; font-size: 8pt; color: #334155; }
      .legend-text strong { color: #0f172a; }
      .status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 7pt; text-transform: uppercase; font-weight: 800; margin-bottom: 4px; }
      .status-text { color: #475569; }
      .status-dot { width: 14px; height: 14px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 7pt; font-weight: 800; color: #fff; }
      .status-ok { background: #16a34a; }
      .status-warn { background: #f59e0b; }
      .status-bad { background: #dc2626; }
      .status-muted { background: #94a3b8; }
      .winner { border: 2px solid #16a34a; background: #f0fdf4; border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .winner-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #166534; font-weight: 700; }
      .winner-name { font-size: 16pt; font-weight: 900; color: #14532d; }
      .winner-score { text-align: right; }
      .winner-score-value { font-size: 28pt; font-weight: 900; color: #15803d; }
      .winner-score-label { font-size: 8pt; text-transform: uppercase; color: #166534; font-weight: 700; }
      .section-block { break-inside: avoid; page-break-inside: avoid; }
      .matrix-block { break-inside: auto; page-break-inside: auto; }
      .matrix-block table,
      .matrix-block thead,
      .matrix-block tbody {
        break-inside: auto;
        page-break-inside: auto;
      }
      .matrix-block thead tr,
      .matrix-row,
      .matrix-row td,
      .matrix-row th {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .matrix-block td, .matrix-block th { overflow-wrap: anywhere; }
      .section-title { background: #0f172a; color: #fff; padding: 8px 12px; font-weight: 800; margin: 12px 0; border-radius: 6px 6px 0 0; page-break-after: avoid; break-after: avoid; }
      .cost-benefit { page-break-before: avoid; break-before: avoid; }
      .cost-benefit { border: 1px solid #e2e8f0; background: #fff; padding: 12px; border-radius: 0 0 6px 6px; margin-bottom: 16px; }
      .cost-note { font-size: 9pt; color: #475569; }
      .cost-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; align-items: start; }
      .cost-chart { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; }
      .cost-legend-title { font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; }
      .cost-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
      .cost-table th, .cost-table td { border: 1px solid #e2e8f0; padding: 4px 6px; }
      .cost-table th { background: #f1f5f9; font-size: 7pt; text-transform: uppercase; }
      .legend-id { font-weight: 800; text-align: center; width: 18px; }
      .cost-legend-foot { font-size: 7pt; color: #64748b; margin-top: 6px; }
      .col-meta { font-size: 7pt; font-weight: normal; margin-top: 2px; }
      .price-row td { border-bottom: 2px solid #0f172a; }
      .price-label { font-weight: 700; text-transform: uppercase; color: #16a34a; }
      .price-sub { color: #64748b; font-style: italic; font-size: 8pt; }
      .price-cell { background: #f0fdf4; }
      .price-value { font-weight: 900; }
      .price-roi { font-size: 8pt; color: #16a34a; font-weight: 700; margin-top: 2px; }
      .attr-name { font-weight: 700; }
      .attr-ref { color: #64748b; font-style: italic; }
      .missing { color: #64748b; font-size: 8pt; display: block; padding: 2px 0; }
      .critical { background: #fef2f2; }
      .critical-note { color: #dc2626; font-weight: 700; font-size: 7pt; text-transform: uppercase; border-top: 1px solid #fecaca; margin-top: 4px; padding-top: 2px; }
      .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
      .card-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; }
      .card-title { font-weight: 800; font-size: 12pt; }
      .card-score { font-weight: 900; font-size: 12pt; }
      .card-reason { font-size: 9pt; color: #475569; background: #f8fafc; padding: 6px; border-radius: 4px; margin-bottom: 8px; font-style: italic; }
      .card-block-title { font-size: 8pt; text-transform: uppercase; font-weight: 800; color: #16a34a; margin-bottom: 4px; }
      .card-block-title.warn { color: #dc2626; }
      ul { margin: 0; padding-left: 16px; }
      footer { margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; font-size: 8pt; color: #94a3b8; }
      @media print {
        * { overflow: visible !important; }
        .header { position: static; }
        .cards { grid-template-columns: 1fr; }
        .card { break-inside: avoid; page-break-inside: avoid; }
        .cost-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    ${renderHeader()}
    ${renderSummary()}
    ${renderLegend()}
    ${renderWinner()}
    ${renderCostBenefit()}
    ${renderTable()}
    ${renderCards()}
    ${labels.footer ? `<footer>${escapeHtml(labels.footer.replace('{date}', dateLabel))}</footer>` : ''}
  </body>
  </html>`;
};

const generateReportPdf = async ({ data, tenant, showDiffOnly, reportCode, brandingLogoUrl, language } = {}) => {
  const html = buildReportHtml(data, tenant, { showDiffOnly, reportCode, brandingLogoUrl, language });
  const lang = normalizeLanguage(language || tenant?.language || tenant?.locale || tenant?.lang);
  const labels = getLabels(lang);

  let browser;
  try {
    browser = await launchChromiumWithFallback();
  } catch (error) {
    throw error;
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
    await page.waitForTimeout(200);

  const headerTemplate = `
    <div style="width: 100%; font-size: 9px; color: #64748b; padding: 0 12mm; display: flex; justify-content: flex-end; align-items: center;">
      <span>${escapeHtml(labels.pageLabel)} </span>
      <span class="pageNumber"></span>
      <span>&nbsp;${escapeHtml(labels.pageSeparator)}&nbsp;</span>
      <span class="totalPages"></span>
    </div>
  `;

  const footerTemplate = `
    <div style="width: 100%; font-size: 9px; color: #94a3b8; padding: 0 12mm; text-align: right;">
      ${escapeHtml(labels.pageLabel)} <span class="pageNumber"></span> ${escapeHtml(labels.pageSeparator)} <span class="totalPages"></span>
    </div>
  `;

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: 'A4',
      landscape: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: '12mm', bottom: '16mm', left: '12mm', right: '12mm' },
    });

    await page.close();
    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

module.exports = { generateReportPdf, normalizeComparisonResult };

const { Type } = require("@google/genai");
const { v4: uuidv4 } = require('uuid');
const connectionManager = require('../db/connectionManager');
const aiFactory = require('../services/aiFactory');
const logger = require('../utils/logger');

let pdfParse = null;
let pdfjsLib = null;
let createCanvas = null;
let createWorker = null;
try {
  pdfParse = require('pdf-parse');
} catch (err) {
  pdfParse = null;
}
try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (err) {
  pdfjsLib = null;
}
try {
  ({ createCanvas } = require('@napi-rs/canvas'));
} catch (err) {
  createCanvas = null;
}
try {
  ({ createWorker } = require('tesseract.js'));
} catch (err) {
  createWorker = null;
}

const TEXT_LIMIT = parseInt(process.env.AI_TEXT_LIMIT || '40000', 10);
const OCR_ENABLED = process.env.ENABLE_PDF_OCR !== 'false';
const OCR_MAX_PAGES = parseInt(process.env.OCR_MAX_PAGES || '5', 10);
const OCR_LANG = process.env.OCR_LANG || 'por+eng';
const MIN_PDF_TEXT_LENGTH = parseInt(process.env.MIN_PDF_TEXT_LENGTH || '200', 10);
const MAX_PDF_PAGES = parseInt(process.env.MAX_PDF_PAGES || '30', 10);

const normalizeLanguage = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'pt';
  if (raw.startsWith('pt')) return 'pt';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('es')) return 'es';
  return 'pt';
};

const languageLabelMap = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
};

const estimateTokens = (value) => {
  if (!value) return 0;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil(text.length / 4));
};

const logAIRequest = async (req, payload) => {
  try {
    const db = connectionManager.getMaster();
    const hasTable = await db.schema.hasTable('ai_request_logs');
    if (!hasTable) return;
    await db('ai_request_logs').insert({
      id: uuidv4(),
      tenant_id: req.tenant?.id || null,
      user_id: req.user?.userId || null,
      provider: payload.provider || 'Unknown',
      model: payload.model || 'unknown',
      context: payload.context || 'unknown',
      tokens_in: payload.tokensIn || 0,
      tokens_out: payload.tokensOut || 0,
      latency_ms: payload.latencyMs || 0,
      success: payload.success !== false,
      error_message: payload.errorMessage || null,
      created_at: new Date(),
    });
  } catch {
    // ignore logging errors
  }
};

const clampText = (text, maxChars = TEXT_LIMIT) => {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + '\n[TRUNCADO]';
};

const normalizeWhitespace = (text) => (text || '').replace(/\s+/g, ' ').trim();

const stripDiacritics = (value) => {
  if (!value || typeof value !== 'string') return '';
  try {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return value;
  }
};

const normalizeToken = (value) => stripDiacritics(String(value || '').toLowerCase().trim());

const toSnakeCase = (value) => {
  const normalized = normalizeToken(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'caracteristica';
};

const normalizePriority = (value) => {
  const v = normalizeToken(value);
  if (v.includes('must') || v.includes('obrig')) return 'MUST';
  if (v.includes('nice') || v.includes('desej')) return 'NICE';
  return 'SHOULD';
};

const normalizeType = (value) => {
  const v = normalizeToken(value);
  if (v.includes('range') || v.includes('faixa')) return 'range';
  if (v.includes('bool') || v.includes('boolean') || v.includes('sim') || v.includes('nao')) return 'bool';
  if (v.includes('enum') || v.includes('categor')) return 'enum';
  if (v.includes('num')) return 'numeric';
  return 'text';
};

const clampScore = (value) => {
  const num = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const coerceScore = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num >= 0 && num <= 1) return clampScore(num * 100);
  return clampScore(num);
};

const isMissingValue = (value) => {
  if (value === null || value === undefined) return true;
  const text = normalizeToken(value);
  return text.length === 0 || text === 'nao informado' || text === 'não informado' || text === 'n/a';
};

const normalizeEvidence = (evidence, sourceName) => {
  if (!evidence || typeof evidence !== 'object') {
    return {
      sourceName: sourceName || null,
      page: null,
      quote: null,
    };
  }
  const quote = typeof evidence.quote === 'string' ? evidence.quote.trim() : null;
  const pageValue = evidence.page === 0 ? 0 : evidence.page;
  return {
    sourceName: evidence.sourceName || sourceName || null,
    page: Number.isFinite(pageValue) ? pageValue : null,
    quote: quote && quote.length > 0 ? quote : null,
  };
};

const parseNumberList = (value) => {
  if (!value) return [];
  const normalized = String(value).replace(/\./g, '').replace(/,/g, '.');
  const matches = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((v) => Number(v)).filter((n) => Number.isFinite(n));
};

const parseNumericRange = (value) => {
  const text = normalizeToken(value);
  const nums = parseNumberList(value);
  if (nums.length === 0) return null;
  if (nums.length >= 2 && (/(\bto\b|ate|até|-|–|—)/i.test(text))) {
    const min = Math.min(nums[0], nums[1]);
    const max = Math.max(nums[0], nums[1]);
    return { min, max };
  }
  if (/(>=|min|minimum|acima|a partir)/i.test(text)) {
    return { min: nums[0] };
  }
  if (/(<=|max|maximum|abaixo|ate|até)/i.test(text)) {
    return { max: nums[0] };
  }
  return { value: nums[0] };
};

const scoreNumeric = (baselineValue, candidateValue) => {
  const baseline = parseNumericRange(baselineValue);
  const candidate = parseNumericRange(candidateValue);
  if (!baseline || !candidate) return { score: 0, reason: 'nao informado' };

  const small = 0.05;
  const medium = 0.15;

  const candidateVal = candidate.value ?? candidate.min ?? candidate.max;
  if (candidateVal === null || candidateVal === undefined) return { score: 0, reason: 'nao informado' };

  if (baseline.min !== undefined || baseline.max !== undefined) {
    const min = baseline.min !== undefined ? baseline.min : -Infinity;
    const max = baseline.max !== undefined ? baseline.max : Infinity;
    if (candidateVal >= min && candidateVal <= max) return { score: 100, reason: 'within_range' };
    const range = Math.max(1, max - min);
    const diff = candidateVal < min ? (min - candidateVal) : (candidateVal - max);
    const ratio = diff / range;
    if (ratio <= small) return { score: 80, reason: 'small_deviation' };
    if (ratio <= medium) return { score: 50, reason: 'medium_deviation' };
    return { score: 0, reason: 'out_of_range' };
  }

  if (baseline.value !== undefined) {
    const target = baseline.value;
    const diff = Math.abs(candidateVal - target);
    const ratio = diff / Math.max(1, Math.abs(target));
    if (ratio <= small) return { score: 100, reason: 'exact_or_close' };
    if (ratio <= medium) return { score: 80, reason: 'small_deviation' };
    if (ratio <= 0.3) return { score: 50, reason: 'partial' };
    return { score: 0, reason: 'far' };
  }

  return { score: 0, reason: 'nao informado' };
};

const scoreCategorical = (baselineValue, candidateValue) => {
  if (isMissingValue(candidateValue)) return { score: 0, reason: 'nao informado' };
  const base = normalizeToken(baselineValue);
  const cand = normalizeToken(candidateValue);
  if (!base || !cand) return { score: 0, reason: 'nao informado' };
  if (base === cand) return { score: 100, reason: 'exact' };

  const yesTokens = new Set(['sim', 'yes', 'true', '1', 'ok']);
  const noTokens = new Set(['nao', 'não', 'no', 'false', '0']);
  if ((yesTokens.has(base) && yesTokens.has(cand)) || (noTokens.has(base) && noTokens.has(cand))) {
    return { score: 90, reason: 'synonym' };
  }

  const baseParts = new Set(base.split(/[_\s]+/).filter(Boolean));
  const candParts = new Set(cand.split(/[_\s]+/).filter(Boolean));
  let overlap = 0;
  baseParts.forEach((part) => {
    if (candParts.has(part)) overlap += 1;
  });
  const ratio = overlap / Math.max(1, baseParts.size);
  if (ratio >= 0.7) return { score: 80, reason: 'minor_diff' };
  if (ratio >= 0.4) return { score: 60, reason: 'partial' };
  if (ratio > 0) return { score: 50, reason: 'weak_match' };
  return { score: 0, reason: 'incompatible' };
};

const scoreAttribute = (baselineAttr, candidateAttr) => {
  const baselineValue = baselineAttr?.valueNormalized || baselineAttr?.valueRaw || '';
  const candidateValue = candidateAttr?.candidateValueNormalized || candidateAttr?.candidateValue || candidateAttr?.valueNormalized || candidateAttr?.valueRaw || '';
  const type = normalizeType(baselineAttr?.type);

  if (isMissingValue(candidateValue)) {
    return { matchScore: 0, reason: 'nao informado' };
  }

  if (type === 'numeric' || type === 'range') {
    const numeric = scoreNumeric(baselineValue, candidateValue);
    return { matchScore: numeric.score, reason: numeric.reason };
  }

  if (type === 'bool' || type === 'enum' || type === 'text') {
    const cat = scoreCategorical(baselineValue, candidateValue);
    return { matchScore: cat.score, reason: cat.reason };
  }

  return { matchScore: 0, reason: 'nao informado' };
};

const buildDocumentSnapshot = (pages, label) => {
  const safePages = Array.isArray(pages) ? pages : [];
  let output = '';
  let truncated = false;
  safePages.forEach((page, idx) => {
    if (truncated) return;
    const header = Number.isFinite(page?.page) ? `[PAGE ${page.page}]` : `[CHUNK ${idx + 1}]`;
    const content = normalizeWhitespace(page?.text || '');
    if (!content) return;
    output += `${header} ${label ? `(${label})` : ''}\n${content}\n\n`;
    if (output.length >= TEXT_LIMIT) {
      output = output.slice(0, TEXT_LIMIT) + '\n[TRUNCADO]';
      truncated = true;
    }
  });
  return { snapshotText: output.trim(), truncated };
};

const extractPdfPagesFromBase64 = async (base64, label, requestId) => {
  if (!pdfjsLib) {
    logger.warn('ai.pdf_pages.missing', { requestId, label });
    return null;
  }
  try {
    const buffer = Buffer.from(base64, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages || 0, MAX_PDF_PAGES);
    if (!pageCount) return [];
    const pages = [];
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const text = normalizeWhitespace(content?.items?.map((item) => item.str).join(' ') || '');
      if (text) {
        pages.push({ page: pageIndex, text });
      }
    }
    return pages;
  } catch (error) {
    logger.warn('ai.pdf_pages.failed', { requestId, label, message: error.message });
    return null;
  }
};

const extractPdfTextWithPagesFromBase64 = async (base64, label, requestId) => {
  const pageChunks = await extractPdfPagesFromBase64(base64, label, requestId);
  if (Array.isArray(pageChunks) && pageChunks.length > 0) {
    const combined = pageChunks.map((p) => p.text).join('\n');
    return { text: clampText(combined), pages: pageChunks, source: 'pdfjs' };
  }

  let parsedText = '';
  if (pdfParse) {
    try {
      const buffer = Buffer.from(base64, 'base64');
      const data = await pdfParse(buffer);
      parsedText = data?.text || '';
    } catch (error) {
      logger.warn('ai.pdf_parse.failed', { requestId, label, message: error.message });
    }
  } else {
    logger.warn('ai.pdf_parse.missing', { requestId, label });
  }

  const cleaned = (parsedText || '').trim();
  if (cleaned.length >= MIN_PDF_TEXT_LENGTH) {
    return { text: clampText(cleaned), pages: [{ page: null, text: cleaned }], source: 'pdf-parse' };
  }

  if (!OCR_ENABLED) {
    return { text: clampText(cleaned), pages: [{ page: null, text: cleaned }], source: 'pdf-parse' };
  }

  logger.info('ai.pdf_ocr.start', {
    requestId,
    label,
    reason: cleaned.length === 0 ? 'empty' : 'short_text',
    length: cleaned.length,
  });
  const ocrText = await ocrPdfFromBase64(base64, label, requestId);
  return { text: ocrText || clampText(cleaned), pages: [{ page: null, text: ocrText || cleaned }], source: 'ocr' };
};

const extractDocumentSnapshotFromInput = async (input, label, requestId) => {
  if (!input) return { snapshotText: '', truncated: false, pages: [], source: null };
  const textContent = input?.content || input?.text || input?.value || '';
  const isText = input?.type === 'text' || typeof textContent === 'string';
  if (isText && textContent) {
    const pages = [{ page: null, text: clampText(textContent) }];
    const snapshot = buildDocumentSnapshot(pages, label);
    return { ...snapshot, pages, source: 'text' };
  }

  const base64 = input?.file?.data || input?.data || null;
  if (base64) {
    const mimeType = input?.file?.mimeType || input?.file?.type || input?.mimeType || '';
    if (mimeType.includes('pdf') || mimeType === '') {
      const extracted = await extractPdfTextWithPagesFromBase64(base64, label, requestId);
      const pages = extracted.pages || [{ page: null, text: extracted.text }];
      const snapshot = buildDocumentSnapshot(pages, label);
      return { ...snapshot, pages, source: extracted.source };
    }
    const bufferText = Buffer.from(base64, 'base64').toString('utf8');
    const pages = [{ page: null, text: clampText(bufferText) }];
    const snapshot = buildDocumentSnapshot(pages, label);
    return { ...snapshot, pages, source: 'text' };
  }

  return { snapshotText: '', truncated: false, pages: [], source: null };
};

const ocrPdfFromBase64 = async (base64, label, requestId) => {
  if (!OCR_ENABLED) return '';
  if (!pdfjsLib || !createCanvas || !createWorker) {
    logger.warn('ai.pdf_ocr.missing_deps', {
      requestId,
      label,
      hasPdfjs: !!pdfjsLib,
      hasCanvas: !!createCanvas,
      hasWorker: !!createWorker,
    });
    return '';
  }

  let worker;
  try {
    const buffer = Buffer.from(base64, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pages = Math.min(pdf.numPages || 0, OCR_MAX_PAGES);
    if (!pages) return '';

    worker = await createWorker();
    await worker.loadLanguage(OCR_LANG);
    await worker.initialize(OCR_LANG);

    let textOutput = '';
    for (let pageIndex = 1; pageIndex <= pages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const imageBuffer = canvas.toBuffer('image/png');
      const { data } = await worker.recognize(imageBuffer);
      if (data?.text) {
        textOutput += `\n${data.text}`;
      }
      if (textOutput.length >= TEXT_LIMIT) break;
    }

    return clampText(textOutput);
  } catch (error) {
    logger.warn('ai.pdf_ocr.failed', { requestId, label, message: error.message });
    return '';
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore termination errors
      }
    }
  }
};

const extractPdfTextFromBase64 = async (base64, label, requestId) => {
  let parsedText = '';
  if (pdfParse) {
    try {
      const buffer = Buffer.from(base64, 'base64');
      const data = await pdfParse(buffer);
      parsedText = data?.text || '';
    } catch (error) {
      logger.warn('ai.pdf_parse.failed', { requestId, label, message: error.message });
    }
  } else {
    logger.warn('ai.pdf_parse.missing', { requestId, label });
  }

  const cleaned = (parsedText || '').trim();
  if (cleaned.length >= MIN_PDF_TEXT_LENGTH) {
    return clampText(cleaned);
  }

  if (!OCR_ENABLED) {
    return clampText(cleaned);
  }

  logger.info('ai.pdf_ocr.start', {
    requestId,
    label,
    reason: cleaned.length === 0 ? 'empty' : 'short_text',
    length: cleaned.length,
  });
  const ocrText = await ocrPdfFromBase64(base64, label, requestId);
  return ocrText || clampText(cleaned);
};

const isGenericReferenceName = (value) => {
  if (!value || typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  const genericLabels = new Set([
    'arquivo fornecido',
    'referencia',
    'referência',
    'reference',
    'reference product',
    'produto referencia',
    'produto referência',
    'documento de referencia',
    'documento de referência',
    'sem referencia',
    'sem referência',
  ]);
  return genericLabels.has(normalized);
};

const isFileLikeName = (value) => {
  if (!value || typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return /\.(pdf|docx?|txt|rtf|odt|xls|xlsx|csv|ppt|pptx)(\s|$)/i.test(normalized);
};

const isGenericCandidateName = (value) => {
  if (!value || typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return /^(item|candidato|candidate|produto|product)\s*\d+$/i.test(normalized);
};

const inferNameFromCharacteristics = (items = []) => {
  if (!Array.isArray(items)) return null;
  const keywords = [
    'produto',
    'product',
    'modelo',
    'model',
    'referencia',
    'referência',
    'reference',
    'part number',
    'pn',
    'codigo',
    'código',
    'item',
    'designacao',
    'designação',
    'nome',
    'name',
  ];

  for (const item of items) {
    const label = (item?.label || '').toString().toLowerCase();
    const key = (item?.key || '').toString().toLowerCase();
    const haystack = `${label} ${key}`;
    if (!keywords.some((k) => haystack.includes(k))) continue;

    const value = item?.valueNormalized || item?.valueRaw || item?.value || '';
    if (!isMissingValue(value)) {
      return normalizeWhitespace(value.toString()).slice(0, 160);
    }
  }

  return null;
};

const normalizeComparisonResult = (raw, referenceInput = {}, candidateInputs = []) => {
  if (!raw || typeof raw !== 'object') return null;

  const hasCanonical =
    raw.referenceName &&
    Array.isArray(raw.candidates) &&
    raw.candidates.length > 0 &&
    raw.candidates[0].productName;

  if (hasCanonical) return raw;

  const referenceObject = raw.reference || raw.referencia || raw.ReferenceProduct || raw.referenceProduct || {};
  const refAttrs = referenceObject?.attributes || referenceObject || {};
  const referenceFallback =
    referenceInput?.name ||
    referenceInput?.file?.name ||
    referenceObject?.name ||
    referenceObject?.modelo ||
    referenceObject?.type ||
    'Referencia';

  const refNameCandidate = raw.referenceName || referenceFallback;
  const refName = isGenericReferenceName(refNameCandidate) ? referenceFallback : refNameCandidate;

  const knownFields = new Set([
    'productName',
    'name',
    'totalScore',
    'isRecommended',
    'reasoning',
    'summary',
    'pros',
    'cons',
    'price',
    'comparison',
    'attributes',
  ]);

  const buildAttributes = (candidate) => {
    if (Array.isArray(candidate?.attributes)) {
      return candidate.attributes.map((attr) => ({
        name: attr.name || attr.characteristic || 'Atributo',
        referenceValue: attr.referenceValue || attr.reference || 'não informado',
        candidateValue: attr.candidateValue || attr.value || attr.candidate || 'não informado',
        matchScore: typeof attr.matchScore === 'number' ? coerceScore(attr.matchScore) : 0,
        confidenceScore: typeof attr.confidenceScore === 'number' ? coerceScore(attr.confidenceScore) : 0,
        requiresVerification: attr.requiresVerification ?? isMissingValue(attr.candidateValue || attr.value || attr.candidate),
      }));
    }

    const attrObject =
      candidate?.attributes && typeof candidate.attributes === 'object' && !Array.isArray(candidate.attributes)
        ? candidate.attributes
        : candidate && typeof candidate === 'object'
          ? Object.fromEntries(
            Object.entries(candidate).filter(([key]) => !knownFields.has(key))
          )
          : null;

    if (attrObject && typeof attrObject === 'object') {
      const comparison = candidate?.comparison || {};
      return Object.entries(attrObject).map(([key, value]) => ({
        name: key,
        referenceValue: refAttrs[key] ?? 'não informado',
        candidateValue: typeof value === 'string' ? value : JSON.stringify(value),
        matchScore:
          typeof comparison[`${key}_match`] === 'boolean'
            ? comparison[`${key}_match`]
              ? 100
              : 0
            : 0,
        confidenceScore: 0,
        requiresVerification: !comparison[`${key}_match`],
      }));
    }

    return [];
  };

  let candidates = [];

  if (Array.isArray(raw.candidates)) {
    candidates = raw.candidates.map((cand, idx) => {
      const fallbackName = candidateInputs[idx]?.name || `Candidato ${idx + 1}`;
      const rawName = cand.productName || cand.name || fallbackName;
      const productName = isGenericCandidateName(rawName) ? fallbackName : rawName;
      return ({
        productName,
        isRecommended: !!cand.isRecommended || idx === 0,
        totalScore: typeof cand.totalScore === 'number' ? coerceScore(cand.totalScore) : 0,
        reasoning: cand.reasoning || cand.summary || '',
        pros: Array.isArray(cand.pros) ? cand.pros : [],
        cons: Array.isArray(cand.cons) ? cand.cons : [],
        attributes: buildAttributes(cand),
        price: cand.price,
      });
    });
  } else if (raw.candidates && typeof raw.candidates === 'object') {
    const entries = Object.entries(raw.candidates);
    candidates = entries.map(([key, cand], idx) => {
      const fallbackName = candidateInputs[idx]?.name || `Candidato ${idx + 1}`;
      const rawName = cand?.productName || cand?.name || key || fallbackName;
      const productName = isGenericCandidateName(rawName) ? fallbackName : rawName;
      return ({
        productName,
        isRecommended: !!cand?.isRecommended || idx === 0,
        totalScore: typeof cand?.totalScore === 'number' ? coerceScore(cand.totalScore) : 0,
        reasoning: cand?.reasoning || cand?.summary || raw?.comparison?.[key] || '',
        pros: Array.isArray(cand?.pros) ? cand.pros : [],
        cons: Array.isArray(cand?.cons) ? cand.cons : [],
        attributes: buildAttributes(cand),
        price: cand?.price,
      });
    });
  } else {
    const candidateKeys = Object.keys(raw).filter((key) =>
      /^candidato_/i.test(key) || /^candidate_/i.test(key)
    );
    if (candidateKeys.length > 0) {
      candidates = candidateKeys.map((key, idx) => {
        const fallbackName = candidateInputs[idx]?.name || `Candidato ${idx + 1}`;
        const rawName = raw[key]?.name || key.replace(/_/g, ' ') || fallbackName;
        const productName = isGenericCandidateName(rawName) ? fallbackName : rawName;
        return ({
          productName,
          isRecommended: idx === 0,
          totalScore: 0,
          reasoning: '',
          pros: [],
          cons: [],
          attributes: buildAttributes(raw[key]),
          price: raw[key]?.price,
        });
      });
    }
  }

  if (candidates.length === 0 && candidateInputs.length > 0) {
    candidates = candidateInputs.map((cand, idx) => ({
      productName: cand?.name || `Candidato ${idx + 1}`,
      isRecommended: idx === 0,
      totalScore: 0,
      reasoning: '',
      pros: [],
      cons: [],
      attributes: [],
      price: null,
    }));
  }

  return {
    referenceName: refName,
    executiveSummary: raw.executiveSummary || raw.summary || '',
    candidates,
  };
};

const getShoppingAssistant = async (req, res) => {
  const db = req.db;

  try {
    const startedAt = Date.now();
    const ai = await aiFactory.getAIClient(); // Uses Factory

    const criticalItems = await db('products')
      .whereRaw('stock_quantity <= min_stock')
      .select('name', 'category', 'stock_quantity', 'min_stock', 'initial_cost');

    if (criticalItems.length === 0) {
      return res.json({ analysis: "Seu estoque técnico está saudável. Nenhuma sugestão de compra pendente." });
    }

    const prompt = `
      Como um especialista em suprimentos da empresa ${req.tenant.name}, analise a lista de itens críticos abaixo e sugira uma estratégia de compra.
      Considere o impacto financeiro (initial_cost) e a urgência (stock_quantity vs min_stock).
      
      DADOS DO ESTOQUE:
      ${JSON.stringify(criticalItems)}
    `;

    const systemInstruction = "Você é um consultor de compras corporativas. Gere uma resposta em Markdown, clara e focada em otimização de custo e tempo.";

    const analysis = await ai.generateContent(prompt, systemInstruction);

    await logAIRequest(req, {
      provider: ai.provider,
      model: ai.modelName,
      context: 'shopping-assistant',
      tokensIn: estimateTokens(prompt),
      tokensOut: estimateTokens(analysis),
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    res.json({ analysis });
  } catch (error) {
    console.error('[AI Assistant Error]:', error);
    await logAIRequest(req, {
      provider: 'Unknown',
      model: 'unknown',
      context: 'shopping-assistant',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      success: false,
      errorMessage: error.message,
    });
    res.status(500).json({ error: 'Falha ao processar inteligência de compras. ' + error.message });
  }
};

const compareProducts = async (req, res) => {
  const { productIds } = req.body;
  const db = req.db;

  if (!productIds || productIds.length < 2) {
    return res.status(400).json({ error: 'Selecione ao menos 2 produtos para comparação.' });
  }

  try {
    const startedAt = Date.now();
    const ai = await aiFactory.getAIClient(); // Uses Factory

    const products = await db('products')
      .whereIn('id', productIds)
      .select('name', 'category', 'technical_specs', 'initial_cost');

    const prompt = `Gere uma matriz comparativa técnica detalhada em JSON para os seguintes itens: ${JSON.stringify(products)}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        referenceName: { type: Type.STRING },
        executiveSummary: { type: Type.STRING },
        candidates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              isRecommended: { type: Type.BOOLEAN },
              totalScore: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } },
              attributes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    value: { type: Type.STRING },
                    matchScore: { type: Type.NUMBER },
                    confidenceScore: { type: Type.NUMBER },
                  },
                  required: ["name", "value", "matchScore"],
                },
              },
            },
            required: ["productName", "totalScore", "attributes"],
          },
        },
      },
      required: ["referenceName", "candidates"],
    };

    const result = await ai.generateJSON(prompt, schema, "Expert em compras técnicas.");

    await logAIRequest(req, {
      provider: ai.provider,
      model: ai.modelName,
      context: 'compare-products',
      tokensIn: estimateTokens(prompt),
      tokensOut: estimateTokens(result),
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    res.json(result);
  } catch (error) {
    console.error('[AI Compare Error]:', error);
    await logAIRequest(req, {
      provider: 'Unknown',
      model: 'unknown',
      context: 'compare-products',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      success: false,
      errorMessage: error.message,
    });
    res.status(500).json({ error: 'Falha ao gerar matriz comparativa. ' + error.message });
  }
};

const BASELINE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    referenceName: { type: Type.STRING },
    characteristics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING },
          valueRaw: { type: Type.STRING },
          valueNormalized: { type: Type.STRING },
          unit: { type: Type.STRING },
          conditions: { type: Type.STRING },
          priority: { type: Type.STRING },
          evidence: {
            type: Type.OBJECT,
            properties: {
              sourceName: { type: Type.STRING },
              page: { type: Type.NUMBER },
              quote: { type: Type.STRING },
            },
          },
        },
        required: ['key', 'label', 'valueRaw'],
      },
    },
  },
  required: ['referenceName', 'characteristics'],
};

const COMPARISON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING },
    summary: { type: Type.STRING },
    pros: { type: Type.ARRAY, items: { type: Type.STRING } },
    cons: { type: Type.ARRAY, items: { type: Type.STRING } },
    comparisons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          label: { type: Type.STRING },
          candidateValueRaw: { type: Type.STRING },
          candidateValueNormalized: { type: Type.STRING },
          unit: { type: Type.STRING },
          conditions: { type: Type.STRING },
          justification: { type: Type.STRING },
          confidenceScore: { type: Type.NUMBER },
          requiresVerification: { type: Type.BOOLEAN },
          evidenceCandidate: {
            type: Type.OBJECT,
            properties: {
              sourceName: { type: Type.STRING },
              page: { type: Type.NUMBER },
              quote: { type: Type.STRING },
            },
          },
          evidenceReference: {
            type: Type.OBJECT,
            properties: {
              sourceName: { type: Type.STRING },
              page: { type: Type.NUMBER },
              quote: { type: Type.STRING },
            },
          },
        },
        required: ['key'],
      },
    },
  },
  required: ['comparisons'],
};

const BASELINE_SYSTEM_INSTRUCTION = `
Voce e um Engenheiro de Homologacao Tecnica.
Leia TODO o documento de referencia.
Liste TODAS as caracteristicas tecnicas sem inventar.
Normalize unidades e valores.
Inclua evidencia (arquivo/pagina/trecho) sempre que possivel.
referenceName deve ser o nome do produto identificado no documento (nunca o nome do arquivo).
Retorne JSON estrito conforme o schema.
`.trim();

const COMPARE_SYSTEM_INSTRUCTION = `
Voce e um Engenheiro de Homologacao Tecnica.
Use SOMENTE a lista baseline como fonte de caracteristicas.
Compare cada caracteristica com o candidato.
Score 0-100 usando a rubrica fornecida.
Inclua evidencia para referencia e candidato.
candidateName deve ser o nome do produto identificado no documento (nunca o nome do arquivo).
Retorne JSON estrito conforme o schema.
`.trim();

const buildGeminiDocumentContents = ({ introText, files = [], snapshots = [] }) => {
  const parts = [];
  if (introText) parts.push({ text: introText });
  files.forEach((file) => {
    if (!file?.data) return;
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType || file.type || 'application/pdf',
      },
    });
    parts.push({ text: `Arquivo: ${file.label || file.name || 'documento'}` });
  });
  snapshots.forEach((snapshot) => {
    if (snapshot) parts.push({ text: snapshot });
  });
  return [{ role: 'user', parts }];
};

const normalizeBaselineResult = (raw, referenceLabel) => {
  const referenceNameRaw = raw?.referenceName || referenceLabel || 'Referencia';
  const rawList = Array.isArray(raw?.characteristics) ? raw.characteristics : [];
  const characteristics = rawList.map((item) => {
    const label = item?.label || item?.name || item?.caracteristica || 'Caracteristica';
    const key = toSnakeCase(item?.key || label);
    const valueRaw = item?.valueRaw || item?.value || item?.valor || '';
    const valueNormalized = item?.valueNormalized || normalizeWhitespace(valueRaw);
    const unit = item?.unit || item?.unidade || null;
    const conditions = item?.conditions || item?.condicoes || null;
    const priority = normalizePriority(item?.priority || item?.prioridade);
    const evidence = normalizeEvidence(item?.evidence || item?.evidencia, referenceLabel);
    return {
      key,
      label,
      type: normalizeType(item?.type),
      valueRaw: valueRaw || 'não informado',
      valueNormalized: valueNormalized || valueRaw || 'não informado',
      unit,
      conditions,
      priority,
      evidence,
    };
  });

  const deduped = new Map();
  characteristics.forEach((item) => {
    if (!deduped.has(item.key)) deduped.set(item.key, item);
  });

  const inferredName = inferNameFromCharacteristics(Array.from(deduped.values()));
  const referenceName = (isGenericReferenceName(referenceNameRaw) || isFileLikeName(referenceNameRaw))
    ? (inferredName || referenceNameRaw)
    : referenceNameRaw;

  return { referenceName, characteristics: Array.from(deduped.values()) };
};

const normalizeCandidateResult = (raw, candidateLabel) => {
  const comparisons = Array.isArray(raw?.comparisons) ? raw.comparisons : [];
  const inferredCandidateName = inferNameFromCharacteristics(
    comparisons.map((entry) => ({
      key: entry?.key,
      label: entry?.label,
      valueNormalized: entry?.candidateValueNormalized,
      valueRaw: entry?.candidateValueRaw,
    }))
  );
  const candidateNameRaw = raw?.candidateName || candidateLabel || 'Candidato';
  const candidateName = (isGenericCandidateName(candidateNameRaw) || isFileLikeName(candidateNameRaw))
    ? (inferredCandidateName || candidateNameRaw)
    : candidateNameRaw;
  return {
    candidateName,
    summary: raw?.summary || '',
    pros: Array.isArray(raw?.pros) ? raw.pros : [],
    cons: Array.isArray(raw?.cons) ? raw.cons : [],
    comparisons: comparisons.map((entry) => {
      const label = entry?.label || entry?.name || entry?.key || 'Caracteristica';
      const key = toSnakeCase(entry?.key || label);
      const candidateValueRaw = entry?.candidateValueRaw || entry?.candidateValue || entry?.value || '';
      const candidateValueNormalized = entry?.candidateValueNormalized || entry?.valueNormalized || normalizeWhitespace(candidateValueRaw);
      return {
        key,
        label,
        candidateValueRaw,
        candidateValueNormalized: candidateValueNormalized || candidateValueRaw || '',
        unit: entry?.unit || null,
        conditions: entry?.conditions || null,
        justification: entry?.justification || entry?.reasoning || '',
        confidenceScore: coerceScore(entry?.confidenceScore),
        requiresVerification: !!entry?.requiresVerification,
        evidenceCandidate: normalizeEvidence(entry?.evidenceCandidate, candidateLabel),
        evidenceReference: normalizeEvidence(entry?.evidenceReference, null),
      };
    }),
  };
};

const buildCandidateOutput = ({ baseline, candidateResult, referenceLabel }) => {
  const comparisonsMap = new Map();
  candidateResult.comparisons.forEach((entry) => {
    if (!comparisonsMap.has(entry.key)) {
      comparisonsMap.set(entry.key, entry);
    }
  });

  const weights = { MUST: 3, SHOULD: 2, NICE: 1 };
  let weightedSum = 0;
  let weightTotal = 0;
  let missingCount = 0;
  let missingEvidenceCount = 0;
  const missingCritical = [];

  const attributes = baseline.characteristics.map((base) => {
    const candidateEntry = comparisonsMap.get(base.key) || {};
    const candidateValue = candidateEntry.candidateValueNormalized || candidateEntry.candidateValueRaw || '';
    const evidenceCandidate = normalizeEvidence(candidateEntry.evidenceCandidate, candidateResult.candidateName);
    const evidenceReference = normalizeEvidence(base.evidence, referenceLabel);
    const scoreInfo = scoreAttribute(base, candidateEntry);
    let matchScore = clampScore(scoreInfo.matchScore);

    const hasCandidateEvidence = !!evidenceCandidate.quote;
    const hasReferenceEvidence = !!evidenceReference.quote;
    const hasEvidence = hasCandidateEvidence && hasReferenceEvidence;
    if (!hasCandidateEvidence || !hasReferenceEvidence) {
      matchScore = Math.min(matchScore, 20);
      missingEvidenceCount += 1;
    }

    const requiresVerification =
      candidateEntry.requiresVerification ||
      isMissingValue(candidateValue) ||
      (!hasEvidence && base.priority === 'MUST');

    if (isMissingValue(candidateValue)) {
      missingCount += 1;
      if (base.priority === 'MUST') {
        missingCritical.push(base.label);
      }
    }

    const weight = weights[base.priority] || 1;
    weightedSum += matchScore * weight;
    weightTotal += weight;

    const confidenceScore = clampScore(
      candidateEntry.confidenceScore || (hasEvidence ? 80 : 40)
    );

    return {
      key: base.key,
      name: base.label,
      referenceValue: base.valueNormalized || base.valueRaw || 'não informado',
      candidateValue: candidateValue || 'não informado',
      matchScore,
      confidenceScore,
      requiresVerification,
      unit: base.unit || candidateEntry.unit || null,
      conditions: base.conditions || candidateEntry.conditions || null,
      evidenceReference,
      evidenceCandidate,
      priority: base.priority,
    };
  });

  const totalScoreRaw = weightTotal ? Math.round(weightedSum / weightTotal) : 0;
  const totalAttributes = attributes.length || 1;
  const missingRatio = missingCount / totalAttributes;
  const evidenceMissingRatio = missingEvidenceCount / totalAttributes;
  let penalty = Math.round(missingRatio * 30);
  if (evidenceMissingRatio > 0.5) penalty += 10;
  const totalScore = clampScore(totalScoreRaw - penalty);

  return {
    productName: candidateResult.candidateName,
    totalScore,
    reasoning: candidateResult.summary || `Score ajustado: ${totalScore}%`,
    pros: candidateResult.pros || [],
    cons: candidateResult.cons || [],
    attributes,
    meta: {
      evidenceCoverage: Math.round((1 - evidenceMissingRatio) * 100),
      missingCoverage: Math.round(missingRatio * 100),
      missingCritical: missingCritical.slice(0, 10),
      penalty,
    },
  };
};

const analyzeRaw = async (req, res) => {
  try {
    const startedAt = Date.now();
    const { reference, candidates, compliance } = req.body;
    if (!reference || !candidates || !Array.isArray(candidates) || candidates.length === 0) {
      logger.warn('ai.analyze_raw.invalid_payload', {
        requestId: req.requestId,
        hasReference: !!reference,
        candidatesCount: Array.isArray(candidates) ? candidates.length : 0,
      });
      return res.status(400).json({ error: 'Payload de analise invalido.' });
    }

    const ai = await aiFactory.getAIClient();
    logger.info('ai.analyze_raw.start', {
      requestId: req.requestId,
      provider: ai.provider,
      model: ai.modelName,
      referenceType: reference?.type,
      candidatesCount: candidates.length,
      hasCompliance: !!compliance,
      tenantId: req.tenant?.id,
    });

    const isGemini = ai.provider === 'Gemini';
    if (!isGemini && reference?.type === 'file') {
      logger.warn('ai.analyze_raw.openai_file', {
        requestId: req.requestId,
        provider: ai.provider,
        referenceName: reference?.file?.name,
      });
    }

    const refLabel = reference?.file?.name || reference?.name || 'Referencia';
    const referenceSnapshot = await extractDocumentSnapshotFromInput(reference, refLabel, req.requestId);
    if (!referenceSnapshot.snapshotText) {
      return res.status(400).json({ error: 'Documento de referencia vazio ou invalido.' });
    }

    if (referenceSnapshot.truncated) {
      logger.warn('ai.reference.truncated', { requestId: req.requestId, label: refLabel });
    }

    const complianceLabel = compliance?.name || 'Compliance';
    const complianceSnapshot = compliance
      ? await extractDocumentSnapshotFromInput(compliance, complianceLabel, req.requestId)
      : { snapshotText: '', pages: [] };

    const baselinePromptText = [
      'PROMPT A - EXTRACAO BASELINE',
      'Leia TODO o documento referencia. Liste TODAS as caracteristicas tecnicas.',
      'Nao invente. Normalize unidades. Inclua evidencia (arquivo/pagina/trecho).',
      'referenceName deve ser o nome do produto identificado no documento, nunca o nome do arquivo.',
      `Document snapshot (${refLabel}):`,
      referenceSnapshot.snapshotText,
      complianceSnapshot.snapshotText ? `COMPLIANCE:
${complianceSnapshot.snapshotText}` : '',
    ].filter(Boolean).join('\n\n');

    const baselinePromptInput = isGemini
      ? buildGeminiDocumentContents({
          introText: baselinePromptText,
          files: reference?.file?.data ? [{ ...reference.file, label: refLabel }] : [],
          snapshots: [referenceSnapshot.snapshotText, complianceSnapshot.snapshotText].filter(Boolean),
        })
      : baselinePromptText;

    const baselineRaw = await ai.generateJSON(
      baselinePromptInput,
      BASELINE_SCHEMA,
      BASELINE_SYSTEM_INSTRUCTION
    );
    logger.info('ai.analyze_raw.baseline_preview', {
      requestId: req.requestId,
      preview: JSON.stringify(baselineRaw || {}).slice(0, 500),
    });
    const baseline = normalizeBaselineResult(baselineRaw, refLabel);
    if (!baseline.characteristics.length) {
      logger.error('ai.baseline.empty', { requestId: req.requestId, reference: refLabel });
      return res.status(500).json({ error: 'Nao foi possivel extrair caracteristicas da referencia.' });
    }

    await logAIRequest(req, {
      provider: ai.provider,
      model: ai.modelName,
      context: 'analyze-raw:baseline',
      tokensIn: estimateTokens(baselinePromptInput),
      tokensOut: estimateTokens(baseline),
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    const baselineList = baseline.characteristics.map((attr) => ({
      key: attr.key,
      label: attr.label,
      type: attr.type,
      valueNormalized: attr.valueNormalized,
      unit: attr.unit,
      conditions: attr.conditions,
      priority: attr.priority,
    }));

    const candidatesOut = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const candLabel = candidate?.name || `Candidato ${i + 1}`;
      const candidateSnapshot = await extractDocumentSnapshotFromInput(candidate, candLabel, req.requestId);

      const comparePromptText = [
        'PROMPT B - COMPARACAO',
        'Use a lista baseline como unica fonte de caracteristicas.',
        'Score 0-100 com rubrica fixa:',
        '100 match exato/equivalente; 80 diferenca menor; 50 parcial; 20 evidencia fraca; 0 ausente/incompativel.',
        'candidateName deve ser o nome do produto identificado no documento, nunca o nome do arquivo.',
        `BASELINE JSON:
${JSON.stringify(baselineList, null, 2)}`,
        `CANDIDATO (${candLabel}) SNAPSHOT:
${candidateSnapshot.snapshotText}`,
        complianceSnapshot.snapshotText ? `COMPLIANCE:
${complianceSnapshot.snapshotText}` : '',
      ].filter(Boolean).join('\n\n');

      const candidateFileData = candidate?.data || candidate?.file?.data;
      const candidateFileMime = candidate?.mimeType || candidate?.file?.mimeType || candidate?.file?.type;
      const comparePromptInput = isGemini
        ? buildGeminiDocumentContents({
            introText: comparePromptText,
            files: candidateFileData ? [{ data: candidateFileData, mimeType: candidateFileMime, label: candLabel }] : [],
            snapshots: [candidateSnapshot.snapshotText, complianceSnapshot.snapshotText].filter(Boolean),
          })
        : comparePromptText;

      const compareRaw = await ai.generateJSON(
        comparePromptInput,
        COMPARISON_SCHEMA,
        COMPARE_SYSTEM_INSTRUCTION
      );

      const candidateResult = normalizeCandidateResult(compareRaw, candLabel);
      const candidateOutput = buildCandidateOutput({
        baseline,
        candidateResult,
        referenceLabel: refLabel,
      });

      logger.info('ai.analyze_raw.guardrails', {
        requestId: req.requestId,
        candidate: candLabel,
        evidenceCoverage: candidateOutput.meta?.evidenceCoverage,
        missingCoverage: candidateOutput.meta?.missingCoverage,
        missingCritical: candidateOutput.meta?.missingCritical,
      });

      logger.info('ai.analyze_raw.raw_preview', {
        requestId: req.requestId,
        candidate: candLabel,
        preview: JSON.stringify(compareRaw || {}).slice(0, 500),
      });

      candidatesOut.push({
        ...candidateOutput,
      });

      await logAIRequest(req, {
        provider: ai.provider,
        model: ai.modelName,
        context: 'analyze-raw:compare',
        tokensIn: estimateTokens(comparePromptInput),
        tokensOut: estimateTokens(candidateOutput),
        latencyMs: Date.now() - startedAt,
        success: true,
      });
    }

    const sorted = [...candidatesOut].sort((a, b) => b.totalScore - a.totalScore);
    const best = sorted[0];
    const executiveSummary = best
      ? `Melhor candidato: ${best.productName} (${best.totalScore}%).`
      : 'Resumo indisponivel.';

    const normalized = {
      referenceName: baseline.referenceName,
      executiveSummary,
      candidates: candidatesOut.map((cand) => ({
        ...cand,
        isRecommended: cand.productName === best?.productName,
      })),
      baseline: {
        referenceName: baseline.referenceName,
        characteristics: baseline.characteristics,
      },
    };

    await logAIRequest(req, {
      provider: ai.provider,
      model: ai.modelName,
      context: 'analyze-raw',
      tokensIn: estimateTokens(baselinePromptInput),
      tokensOut: estimateTokens(normalized),
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    res.json(normalized);
  } catch (error) {
    logger.error('ai.analyze_raw.error', { requestId: req.requestId, message: error.message }, error);
    await logAIRequest(req, {
      provider: 'Unknown',
      model: 'unknown',
      context: 'analyze-raw',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      success: false,
      errorMessage: error.message,
    });
    res.status(500).json({ error: error.message });
  }
};

const generateRfq = async (req, res) => {
  const startedAt = Date.now();
  try {
    const reportData = req.body?.reportData || req.body;
    if (!reportData || typeof reportData !== 'object') {
      return res.status(400).json({ error: 'Dados do relatório inválidos.' });
    }

    const referenceName =
      reportData.referenceName ||
      reportData.reference_name ||
      reportData.referenceTitle ||
      'Item de Referência';
    const candidates = Array.isArray(reportData.candidates) ? reportData.candidates : [];
    const candidateNames = candidates
      .map((cand) => cand.productName || cand.name || cand.label)
      .filter(Boolean);
    const candidatesLabel = candidateNames.length > 0 ? candidateNames.join(', ') : 'candidatos analisados';

    const jobLanguage = normalizeLanguage(
      reportData.language || req.tenant?.language || req.tenant?.locale || req.tenant?.lang,
    );
    const languageLabel = languageLabelMap[jobLanguage] || languageLabelMap.pt;
    const languageInstruction = `IDIOMA OBRIGATORIO: ${languageLabel}. Responda 100% neste idioma. Nao misture linguas.`;

    const prompt = `
Gere uma minuta de RFQ (Request for Quotation) técnica e formal baseada no produto de referência "${referenceName}".
Inclua: escopo técnico, requisitos mínimos, documentos obrigatórios, critérios de conformidade e prazos.
Exija que os fornecedores enderecem falhas ou lacunas identificadas nos candidatos atuais: ${candidatesLabel}.
Seja objetivo, estruturado em seções e com linguagem profissional.
`;

    const ai = await aiFactory.getAIClient();
    const text = await ai.generateContent(prompt, languageInstruction);

    await logAIRequest(req, {
      provider: ai.provider,
      model: ai.modelName,
      context: 'rfq',
      tokensIn: estimateTokens(prompt),
      tokensOut: estimateTokens(text),
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    return res.json({ text: text || '' });
  } catch (error) {
    logger.error('ai.rfq.error', { requestId: req.requestId, message: error.message }, error);
    await logAIRequest(req, {
      provider: 'Unknown',
      model: 'unknown',
      context: 'rfq',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorMessage: error.message,
    });
    return res.status(500).json({ error: 'Falha ao gerar RFQ.' });
  }
};

const chatWithReport = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { reportData, userMsg } = req.body || {};
    if (!userMsg || typeof userMsg !== 'string') {
      return res.status(400).json({ error: 'Mensagem do usuário é obrigatória.' });
    }

    if (req.tenant) {
      try {
        const billingService = require('../services/billingService');
        const wallet = await billingService.getTenantWalletBalance(req.tenant);
        if (wallet && typeof wallet.balance === 'number' && wallet.balance <= 0) {
          return res.status(402).json({
            error: 'INSUFFICIENT_TOKENS',
            details: `Saldo insuficiente (${wallet.balance}). Recarregue seus tokens para continuar.`,
          });
        }
      } catch (err) {
        if (err.status === 402) throw err;
      }
    }

    const ai = await aiFactory.getAIClient();
    const systemInstruction = `Você é o consultor técnico de compras do Compara IA. Responda com base neste relatório: ${JSON.stringify(reportData || {})}. Seja claro, objetivo e profissional.`;
    const text = await ai.generateContent(userMsg, systemInstruction);

    await logAIRequest(req, {
      provider: ai.provider,
      model: ai.modelName,
      context: 'chat-report',
      tokensIn: estimateTokens(userMsg),
      tokensOut: estimateTokens(text),
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    return res.json({ text: text || '', sources: [] });
  } catch (error) {
    logger.error('ai.chat.error', { requestId: req.requestId, message: error.message }, error);
    await logAIRequest(req, {
      provider: 'Unknown',
      model: 'unknown',
      context: 'chat-report',
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorMessage: error.message,
    });
    return res.status(500).json({ error: error.message || 'Falha na consulta com IA.' });
  }
};

module.exports = {
  getShoppingAssistant,
  compareProducts,
  analyzeRaw,
  generateRfq,
  chatWithReport,
  _internal: {
    parseNumericRange,
    scoreNumeric,
    scoreCategorical,
    scoreAttribute,
    normalizeBaselineResult,
    normalizeCandidateResult,
    buildCandidateOutput,
    coerceScore,
  },
};

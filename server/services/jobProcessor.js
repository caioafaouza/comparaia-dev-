
const { v4: uuidv4 } = require('uuid');
const connectionManager = require('../db/connectionManager');
const billingService = require('./billingService');
const aiFactory = require('./aiFactory');
const logger = require('../utils/logger');
const config = require('../config/env');

let pdfParse = null;
try {
    pdfParse = require('pdf-parse');
} catch {
    pdfParse = null;
}

const TEXT_LIMIT = parseInt(process.env.AI_TEXT_LIMIT || '40000', 10);

const clampText = (text, maxChars = TEXT_LIMIT) => {
    if (!text || typeof text !== 'string') return '';
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) return trimmed;
    return trimmed.slice(0, maxChars) + '\n[TRUNCADO]';
};

const estimateTokens = (value) => {
    if (!value) return 0;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return Math.max(1, Math.ceil(text.length / 4));
};

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
    es: 'Español'
};

const LANGUAGE_DETECT_TOKENS = {
    pt: [' de ', ' que ', ' e ', ' para ', ' nao ', ' com ', ' requisito ', ' documento ', ' candidato ', ' atende '],
    en: [' the ', ' and ', ' of ', ' to ', ' not ', ' with ', ' requirement ', ' document ', ' candidate ', ' meets '],
    es: [' de ', ' y ', ' el ', ' la ', ' para ', ' no ', ' con ', ' requisito ', ' documento ', ' candidato ', ' cumple ']
};

const detectLanguage = (text) => {
    if (!text) return null;
    const normalized = ` ${String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')} `;
    const scores = { pt: 0, en: 0, es: 0 };
    Object.keys(LANGUAGE_DETECT_TOKENS).forEach((lang) => {
        LANGUAGE_DETECT_TOKENS[lang].forEach((token) => {
            if (normalized.includes(token)) scores[lang] += 1;
        });
    });
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : null;
};

const collectNarrativeText = (result) => {
    if (!result) return '';
    const parts = [];
    if (result.executiveSummary) parts.push(result.executiveSummary);
    if (Array.isArray(result.candidates)) {
        result.candidates.forEach((cand) => {
            if (cand?.reasoning) parts.push(cand.reasoning);
            if (Array.isArray(cand?.pros)) parts.push(cand.pros.join(' '));
            if (Array.isArray(cand?.cons)) parts.push(cand.cons.join(' '));
        });
    }
    return parts.join(' ').slice(0, 4000);
};

const logAIRequest = async ({
    tenantId,
    userId,
    provider,
    model,
    context,
    tokensIn,
    tokensOut,
    latencyMs,
    success,
    errorMessage,
}) => {
    try {
        const db = connectionManager.getMaster();
        const hasTable = await db.schema.hasTable('ai_request_logs');
        if (!hasTable) return;
        await db('ai_request_logs').insert({
            id: uuidv4(),
            tenant_id: tenantId || null,
            user_id: userId || null,
            provider: provider || 'Unknown',
            model: model || 'unknown',
            context: context || 'job-processor',
            tokens_in: tokensIn || 0,
            tokens_out: tokensOut || 0,
            latency_ms: latencyMs || 0,
            success: success !== false,
            error_message: errorMessage || null,
            created_at: new Date(),
        });
    } catch {
        // ignore logging errors
    }
};

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
});

const downloadObject = async (objectKey) => {
    const storage = connectionManager.getStorage();
    if (!storage || !objectKey) return null;
    return new Promise((resolve, reject) => {
        storage.getObject(config.storage.bucket, objectKey, async (err, stream) => {
            if (err) return reject(err);
            try {
                const buffer = await streamToBuffer(stream);
                resolve(buffer);
            } catch (e) {
                reject(e);
            }
        });
    });
};

const extractTextFromBuffer = async (buffer, mimeType = '') => {
    if (!buffer || !buffer.length) return '';
    const safeMime = mimeType || '';

    if (safeMime.includes('pdf') && pdfParse) {
        try {
            const data = await pdfParse(buffer);
            return clampText(data?.text || '');
        } catch {
            return '';
        }
    }

    if (safeMime.startsWith('text/')) {
        return clampText(buffer.toString('utf8'));
    }

    return '';
};

const isFileLikeName = (value) => {
    if (!value || typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return /\.(pdf|docx?|txt|rtf|odt|xls|xlsx|csv|ppt|pptx)(\s|$)/i.test(normalized);
};

const isGenericName = (value) => {
    if (!value || typeof value !== 'string') return true;
    const normalized = value.trim().toLowerCase();
    return /^(referencia|referência|reference|produto|product|item|candidato|candidate)(\s*\d+)?$/i.test(normalized);
};

const inferNameFromText = (text) => {
    if (!text || typeof text !== 'string') return '';
    const patterns = [
        /(?:produto|product|modelo|model|refer[eê]ncia|reference|part number|pn|c[oó]digo|codigo|item|designa[cç][aã]o|nome)\s*[:\-]\s*([^\r\n;]+)/i,
    ];
    for (const re of patterns) {
        const match = text.match(re);
        if (match && match[1]) {
            const candidate = match[1].trim();
            if (candidate && candidate.length >= 2) {
                return candidate.slice(0, 160);
            }
        }
    }
    return '';
};

const CRITICAL_MARKER_REGEX = /(\[CRITICO\]|\[CRÍTICO\]|\bCRITICO\b|\bCRÍTICO\b)/i;

const extractCriticalLines = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && CRITICAL_MARKER_REGEX.test(line));
};

const stripCriticalMarkers = (line) => {
    if (!line) return '';
    return line
        .replace(/^\s*\d+[\).]\s*/, '')
        .replace(/\[CRITICO\]|\[CRÍTICO\]|\bCRITICO\b:?|\bCRÍTICO\b:?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const normalizePercent = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(num)) return 0;
    const scaled = num <= 1 ? num * 100 : num;
    return Math.max(0, Math.min(100, scaled));
};

// Calculate cost server-side based on global config (base per job + variable per file).
const MIN_COST = 1;
const toNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
};

const calculateJobCost = (params = {}) => {
    const rawCandidate = params?.candidateCount ?? params?.candidate_count;
    const parsedCandidate = Number.parseInt(String(rawCandidate ?? ''), 10);
    const candidateCount = Number.isFinite(parsedCandidate) && parsedCandidate >= 0 ? parsedCandidate : null;

    const parsedFiles = Number.parseInt(String(params?.fileCount ?? ''), 10);
    const fileCount = Number.isFinite(parsedFiles) && parsedFiles > 0 ? parsedFiles : null;

    const cfg = params?.config || {};
    const baseCostPerJob = toNumber(cfg.baseCostPerJob, MIN_COST);
    const costPerFile = toNumber(cfg.costPerCandidate ?? cfg.costPerFile, 0);

    const referenceCount = params?.hasReference === false ? 0 : 1;
    const effectiveFileCount = fileCount ?? (candidateCount !== null ? candidateCount + referenceCount : 1);

    const rawCost = baseCostPerJob + (costPerFile * effectiveFileCount);
    const normalized = Math.max(0, Math.round(rawCost));
    return normalized;
};

const processJob = async (jobId, tenant) => {
    const tenantDb = connectionManager.getTenantConnection(tenant);

    try {
        logger.info('job.processor.start', { jobId, tenant: tenant.id });
        const startedAt = Date.now();

        // 1. Update Status to PROCESSING
        await tenantDb('comparison_jobs')
            .where({ id: jobId })
            .update({ status: 'PROCESSING', started_at: new Date() });

        // 2. Fetch Job Data (Files, Reference)
        const job = await tenantDb('comparison_jobs').where({ id: jobId }).first();
        if (!job) throw new Error('Job not found in tenant DB');

        // 3. Prepare AI Prompt
        // Real implementation would download files from Storage/MinIO
        // For this fix, we construct a prompt using the reference name and metadata
        // to prove we are hitting the AI provider.

        const normalizeFiles = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return [];
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) return parsed;
                    return parsed ? [parsed] : [];
                } catch {
                    return [];
                }
            }
            if (typeof value === 'object') {
                return Object.keys(value).length ? [value] : [];
            }
            return [];
        };

        const aiParams = {
            reference: job.reference_name,
            files: normalizeFiles(job.files)
        };

        const referenceFile = aiParams.files.find((f) => f?.field === 'reference') || null;
        const candidateFiles = aiParams.files.filter((f) => f?.field === 'candidates');

        const referenceLabelFallback = referenceFile?.originalName || job.reference_name || 'Referencia';
        let referenceText = '';
        if (referenceFile?.inlineText) {
            referenceText = clampText(referenceFile.inlineText);
        } else if (referenceFile?.objectKey) {
            try {
                const buffer = await downloadObject(referenceFile.objectKey);
                referenceText = await extractTextFromBuffer(buffer, referenceFile.mimeType || '');
            } catch (err) {
                logger.warn('job.processor.reference_download_failed', { jobId, error: err.message });
            }
        }
        const referenceNameFromText = inferNameFromText(referenceText);
        const referenceLabel = referenceNameFromText || referenceLabelFallback;

        const candidateInputs = [];
        for (const cand of candidateFiles) {
            const label = cand?.originalName || cand?.objectKey || `Candidato`;
            let text = '';
            if (cand?.objectKey) {
                try {
                    const buffer = await downloadObject(cand.objectKey);
                    text = await extractTextFromBuffer(buffer, cand.mimeType || '');
                } catch (err) {
                    logger.warn('job.processor.candidate_download_failed', { jobId, error: err.message });
                }
            }
            const inferredName = inferNameFromText(text);
            const name = inferredName || label;
            candidateInputs.push({ name, text });
        }

        const jobLanguage = normalizeLanguage(job.language || tenant?.language || tenant?.locale || tenant?.lang);
        const languageLabel = languageLabelMap[jobLanguage] || languageLabelMap.pt;
        const languageInstruction = `IDIOMA OBRIGATÓRIO: ${languageLabel}. TODO o relatório (títulos, listas, pareceres e resumo) deve estar 100% em ${languageLabel}. Não misture idiomas. Preserve nomes próprios, códigos, valores e unidades; traduza apenas o texto descritivo para ${languageLabel}.`;

        const COMPARAIA_PROMPT_V1 = `
PROMPT COMPARAIA v1.0
Funcao: Analista Tecnico de Homologacao e Conformidade
Objetivo: comparar itens candidatos contra um ITEM BASE ou um TERMO DE REFERENCIA, gerando um relatorio tecnico rastreavel, com matriz completa, evidencias e decisao.

REGRA MAXIMA
Toda a analise depende da identificacao inicial, exaustiva e estruturada dos requisitos do ITEM BASE.
Sem requisitos bem extraidos, nao existe comparacao confiavel.
Nunca invente requisito. Nunca preencha lacuna com suposicao.
Quando um candidato nao traz evidencia no texto fornecido, marque como NAO INFORMADO e trate como desvio conforme criticidade.
Itens marcados com [CRITICO] no BASE_DOC sao requisitos CRITICOS e devem ser tratados como CRITICO.

ESCOPO DE DADOS
Voce nao faz pesquisa externa.
Voce trabalha somente com:
1) Texto ou PDF do ITEM BASE (requisitos, normas, contexto)
2) Texto ou PDF dos ITENS CANDIDATOS (datasheets, proposta, certificados, laudos, catalogos)
Se a informacao nao estiver nos arquivos recebidos, ela nao existe para esta analise.

REGRAS DE QUALIDADE
1. Rastreabilidade: toda linha "Atende" precisa de evidencia.
2. Integridade: a matriz inclui 100% dos requisitos extraidos do base.
3. Fidelidade: requisito do base deve aparecer como texto fiel, sem reinterpretacao que altere o sentido.
4. Conflitos: use sinonimos quando necessario; se ambiguo, marque NAO INFORMADO.
5. Sem marketing: nada de texto vendedor, apenas fatos.

REGRA DE DECISAO E SCORE
Eliminacao automatica:
- Se qualquer requisito Critico estiver em NAO ATENDE, candidato ELIMINADO.
- Se requisito Critico estiver NAO INFORMADO, candidato BLOQUEADO POR DOCUMENTO.
Pontuacao:
Critico = 5, Alto = 3, Medio = 2, Baixo = 1.
Atende = 100% do peso, Parcial = 50%, Nao informado = 0, Nao atende = 0.
Score final = (pontos obtidos / pontos possiveis) x 100.
Penalidade por contradicao interna: -5 pontos e registrar no parecer.

SAIDA
Retorne JSON estrito no schema informado pelo sistema.
Obrigatorio manter as chaves: referenceName, executiveSummary, candidates[].
Use candidates[].attributes[] como matriz tecnica (1 atributo por requisito do base).
Em attributes[]:
- name = requisito do base (texto fiel ou ID + texto)
- referenceValue = valor exigido
- candidateValue = valor do candidato (se tiver evidencia) ou "NAO INFORMADO"
- matchScore/confidenceScore = 0..100
- requiresVerification = true quando NAO INFORMADO ou evidencia fraca
Se possivel, inclua evidencia textual no candidateValue (ex: "valor ... | EVIDENCIA: ...").

REGRA DE IDIOMA
${languageInstruction}

PASSO A PASSO
1) Leia e saneie BASE_DOC.
2) Extraia requisitos do BASE_DOC (exhaustivo).
3) Audite completude do base e aponte lacunas (nao criar requisitos novos).
4) Para cada candidato, encontre evidencias e preencha matriz.
5) Aplique score e gere parecer objetivo.
6) Recomendacao final objetiva.
`;

        let prompt = `${languageInstruction}\n\nBASE_DOC:\nNome: ${referenceLabel}\n`;
        if (referenceText) {
            prompt += `Conteudo:\n${referenceText}\n\n`;
        }
        const criticalLines = extractCriticalLines(referenceText);
        if (criticalLines.length) {
            prompt += `Itens CRITICOS declarados no BASE_DOC:\n`;
            criticalLines.forEach((line) => {
                const cleaned = stripCriticalMarkers(line);
                if (cleaned) prompt += `- ${cleaned}\n`;
            });
            prompt += `\n`;
        }
        if (candidateInputs.length === 0 && job.candidate_count) {
            for (let i = 0; i < job.candidate_count; i += 1) {
                candidateInputs.push({ name: `Candidato ${i + 1}`, text: '' });
            }
        }
        prompt += `CANDIDATE_DOCS:\n`;
        candidateInputs.forEach((cand, idx) => {
            prompt += `Item ${idx + 1}:\n`;
            prompt += `Nome: ${cand.name}\n`;
            if (cand.text) {
                prompt += `Conteudo:\n${cand.text}\n\n`;
            }
        });
        prompt += `\nResponda em JSON com: referenceName, executiveSummary e candidates[] contendo productName, totalScore (0-100), reasoning, pros, cons e attributes[] (name, referenceValue, candidateValue, matchScore (0-100), confidenceScore (0-100), requiresVerification).`;
// 4. Call AI
        const ai = await aiFactory.getAIClient();
        logger.info('job.processor.calling_ai', { provider: ai.provider, model: ai.modelName });

        const aiResultSchema = {
            type: "OBJECT",
            properties: {
                referenceName: { type: "STRING" },
                executiveSummary: { type: "STRING" },
                candidates: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            productName: { type: "STRING" },
                            totalScore: { type: "NUMBER" },
                            isRecommended: { type: "BOOLEAN" },
                            reasoning: { type: "STRING" },
                            pros: { type: "ARRAY", items: { type: "STRING" } },
                            cons: { type: "ARRAY", items: { type: "STRING" } },
                            attributes: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        name: { type: "STRING" },
                                        referenceValue: { type: "STRING" },
                                        candidateValue: { type: "STRING" },
                                        matchScore: { type: "NUMBER" },
                                        confidenceScore: { type: "NUMBER" },
                                        requiresVerification: { type: "BOOLEAN" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        let aiResult;
        try {
            // Using generateJSON ensures structured output
            aiResult = await ai.generateJSON(prompt, aiResultSchema, COMPARAIA_PROMPT_V1);
        } catch (aiErr) {
            logger.error('job.processor.ai_error', { message: aiErr.message });
            throw aiErr;
        }

        if (!aiResult || typeof aiResult !== 'object') {
            aiResult = {};
        }
        if (!Array.isArray(aiResult.candidates) || aiResult.candidates.length === 0) {
            const fallbackScore = normalizePercent(aiResult.score ?? 0.5);
            aiResult = {
                referenceName: aiResult.referenceName || referenceLabel,
                executiveSummary: aiResult.executiveSummary || aiResult.summary || '',
                candidates: candidateInputs.map((cand, idx) => ({
                    productName: cand.name || `Candidato ${idx + 1}`,
                    totalScore: fallbackScore,
                    isRecommended: idx === 0,
                    reasoning: aiResult.summary || '',
                    pros: [],
                    cons: [],
                    attributes: []
                }))
            };
        }

        const detectedLang = detectLanguage(collectNarrativeText(aiResult));
        const shouldTranslate = detectedLang && detectedLang !== jobLanguage;
        if (shouldTranslate) {
            logger.warn('job.processor.language_mismatch', {
                jobId,
                expected: jobLanguage,
                detected: detectedLang || 'unknown',
            });
            try {
                const translatePrompt = `
Traduza o JSON abaixo para ${languageLabel}. 
Regras:
- Nao altere as chaves.
- Preserve productName, referenceName, candidateValue e referenceValue exatamente como estao.
- Nao altere numeros, unidades, codigos, nomes de arquivos e evidencias.
- Traduza apenas textos descritivos (executiveSummary, reasoning, pros, cons, attributes[].name quando for frase).
JSON:
${JSON.stringify(aiResult)}
`;
                const translated = await ai.generateJSON(translatePrompt, aiResultSchema, languageInstruction);
                if (translated && typeof translated === 'object') {
                    aiResult = translated;
                }
            } catch (err) {
                logger.error('job.processor.language_translate_failed', { message: err.message });
            }
        }

        const finalDetectedLang = detectLanguage(collectNarrativeText(aiResult));
        if (finalDetectedLang && finalDetectedLang !== jobLanguage) {
            throw new Error(`LANGUAGE_MISMATCH_${jobLanguage}`);
        }

        const fallbackReferenceName = referenceNameFromText || referenceLabel;
        const rawReferenceName = aiResult.referenceName || fallbackReferenceName;
        const referenceName = (isGenericName(rawReferenceName) || isFileLikeName(rawReferenceName))
            ? fallbackReferenceName
            : rawReferenceName;

        const normalizedCandidates = (aiResult.candidates || []).map((cand, idx) => {
            const fallbackName = candidateInputs[idx]?.name || `Candidato ${idx + 1}`;
            const rawName = cand?.productName || cand?.name || fallbackName;
            const productName = (isGenericName(rawName) || isFileLikeName(rawName)) ? fallbackName : rawName;
            const attributes = Array.isArray(cand?.attributes)
                ? cand.attributes.map((attr) => ({
                    ...attr,
                    matchScore: normalizePercent(attr?.matchScore),
                    confidenceScore: normalizePercent(attr?.confidenceScore),
                }))
                : [];
            return {
                ...cand,
                productName,
                totalScore: normalizePercent(cand?.totalScore),
                attributes,
            };
        });

        aiResult = {
            ...aiResult,
            referenceName,
            candidates: normalizedCandidates,
        };

        await logAIRequest({
            tenantId: tenant?.id,
            userId: job?.user_id || null,
            provider: ai.provider,
            model: ai.modelName,
            context: 'job-processor',
            tokensIn: estimateTokens(prompt),
            tokensOut: estimateTokens(aiResult),
            latencyMs: Date.now() - startedAt,
            success: true,
        });

        // 5. Save Result
        await tenantDb('comparison_jobs')
            .where({ id: jobId })
            .update({
                status: 'COMPLETED',
                completed_at: new Date(),
                result: aiResult,
                reference_name: aiResult.referenceName || job.reference_name
            });

        // 6. Capture Credits
        await billingService.captureCredits(jobId);
        logger.info('job.processor.success', { jobId });

    } catch (error) {
        logger.error('job.processor.failed', { jobId, error: error.message });
        await logAIRequest({
            tenantId: tenant?.id,
            userId: null,
            provider: 'Unknown',
            model: 'unknown',
            context: 'job-processor',
            tokensIn: 0,
            tokensOut: 0,
            latencyMs: 0,
            success: false,
            errorMessage: error.message,
        });

        // Refund Credits
        await billingService.refundCredits(jobId);

        // Update Status to FAILED
        await tenantDb('comparison_jobs')
            .where({ id: jobId })
            .update({
                status: 'FAILED',
                error_message: error.message,
                completed_at: new Date()
            });
    }
};


const processQueuedJobs = async ({ limit }) => {
    let totalProcessed = 0;
    try {
        const masterDb = connectionManager.getMaster();
        const tenants = await masterDb('tenants').select('*');

        for (const tenant of tenants) {
            try {
                const tenantDb = connectionManager.getTenantConnection(tenant);
                const jobs = await tenantDb('comparison_jobs')
                    .where({ status: 'QUEUED' })
                    .limit(limit || 5);

                for (const job of jobs) {
                    await processJob(job.id, tenant);
                    totalProcessed++;
                }
            } catch (err) {
                logger.error(`Error processing tenant ${tenant.slug}`, err);
            }
        }
    } catch (e) {
        logger.error('Error fetching tenants', e);
    }
    return totalProcessed;
};

module.exports = {
    processJob,
    calculateJobCost,
    processQueuedJobs
};

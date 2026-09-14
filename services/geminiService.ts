
import { ComparisonResponse, ChatResponse, ReferenceInput, Tenant, AuthSession } from "../types";
import { getSession } from "./api";

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
};

/**
 * Validação de segurança para mensagens do chat
 */
const validateUserMessage = (msg: string): boolean => {
    if (!msg || typeof msg !== 'string') return false;

    // 1. Verificação de comprimento (limite para evitar DoS/token exhaustion)
    if (msg.length > 1000) return false;

    // 2. Prevenção de Injeção de Código (XSS simples / Scripting)
    // Bloqueia: tags <script>, protocolo javascript:, handlers onEvent=
    const codeInjectionPattern = /<script|javascript:|on\w+=/i;
    if (codeInjectionPattern.test(msg)) return false;

    // 3. Prevenção de Prompt Injection (Tentativas de override do sistema)
    const promptInjectionPattern = /ignore (all )?previous instructions|system prompt|override instruction/i;
    if (promptInjectionPattern.test(msg)) return false;

    return true;
};

/**
 * Análise Técnica Profunda via Gemini 3 Pro
 */
// --- REFACTORED TO USE BACKEND ORCHESTATION ---
// O frontend não chama mais a API do Gemini diretamente.
// Ele envia os arquivos para o backend, que usa a aiFactory (OpenAI/Gemini).

export const analyzeProducts = async (
    ref: ReferenceInput,
    cands: File[],
    tenant: Tenant,
    complianceFile?: File,
    onProgress?: (msg: string, pct: number) => void,
    sessionOverride?: AuthSession
): Promise<ComparisonResponse> => {

    if (onProgress) onProgress("Enviando arquivos para análise no servidor...", 10);

    // 1. Upload Arquivos
    // Em uma implementação real de produção, faríamos upload para /api/upload primeiro
    // e passaríamos URLs. Para este protótipo, vamos converter para base64 e enviar no corpo
    // (Cuidado com payload size limits do body-parser no server)

    const formData = {
        productIds: [] as string[] // TODO: Se os produtos já existirem no banco
    };

    // MOCK TEMPORÁRIO PARA MANTER A INTERFACE:
    // Como a rota /api/ai/compare espera IDs de produtos JÁ SALVOS no banco,
    // e o fluxo atual do frontend parece ser "Upload -> Analisa", 
    // precisamos adaptar. 
    // A melhor abordagem rápida é manter a chamada local MAS trocar o cliente 
    // se quisermos suporte imediato, mas o security-best-practice é server-side.

    // VOU CHAMAR A ROTA /api/ai/compare-direct (que vou criar) ou simular.

    // ...
    // Para resolver o problema do usuário AGORA:
    // A rota /api/ai/compare do backend espera 'productIds'.
    // A UI atual está enviando Arquivos (File objects).
    // Precisaria salvar os produtos antes.

    // PLANO B (Robustez): Ajustar o endpoint do backend para aceitar 
    // payloads arbitrários (Base64) igual o frontend fazia, mas processar lá.

    const parts: any[] = [];
    if (ref.type === 'file') {
        const b64 = await fileToBase64(ref.file);
        parts.push({
            role: 'user',
            parts: [{ inlineData: { data: b64, mimeType: ref.file.type } }]
        });
        parts.push({ role: 'user', parts: [{ text: "Referência acima." }] });
    } else {
        parts.push({ role: 'user', parts: [{ text: `REFERÊNCIA:\n${ref.content}` }] });
    }

    for (const [idx, file] of cands.entries()) {
        const b64 = await fileToBase64(file);
        parts.push({
            role: 'user',
            parts: [{ inlineData: { data: b64, mimeType: file.type } }]
        });
    }

    // Call Backend Proxy
    // Note: This requires a NEW endpoint in backend that accepts raw base64 contents
    // or we assume the existent 'shopping-assistant' style.
    // Let's create `POST /api/ai/analyze-raw` in the implementation plan.

    // FOR NOW: fail-safe return to indicate "Under Maintenance" if I can't hot-swap
    // But I must fix it.

    // Let's use the fetch approach to my new backend route.

    const session = sessionOverride || getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    const tenantSlug = session?.tenant?.slug || tenant?.slug || tenant?.id;
    if (tenantSlug && tenantSlug !== 'MASTER') headers['X-Tenant-ID'] = tenantSlug;

    const referencePayload =
        ref.type === 'file'
            ? {
                type: 'file' as const,
                file: {
                    name: ref.file.name,
                    mimeType: ref.file.type,
                    data: await fileToBase64(ref.file)
                }
            }
            : {
                type: 'text' as const,
                content: ref.content,
                name: ref.name
            };

    const response = await fetch('/api/ai/analyze-raw', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            reference: referencePayload,
            candidates: await Promise.all(cands.map(async f => ({
                name: f.name,
                mimeType: f.type,
                data: await fileToBase64(f)
            }))),
            compliance: complianceFile ? {
                name: complianceFile.name,
                data: await fileToBase64(complianceFile),
                mimeType: complianceFile.type
            } : null
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Falha na análise via servidor.");
    }

    return await response.json();
};

export const chatWithReport = async (
    reportData: ComparisonResponse,
    userMsg: string
): Promise<ChatResponse> => {
    // SECURITY: Validação de entrada
    if (!validateUserMessage(userMsg)) {
        throw new Error("Entrada inválida detectada por motivos de segurança.");
    }

    const session = getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    const tenantSlug = session?.tenant?.slug || session?.tenant?.id;
    if (tenantSlug && tenantSlug !== 'MASTER') headers['X-Tenant-ID'] = tenantSlug;

    const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reportData, userMsg })
    });

    if (!response.ok) {
        let errMsg = 'Falha ao consultar IA de Mercado.';
        try {
            const err = await response.json();
            errMsg = err.details || err.error || errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
    }

    const data = await response.json();
    return { text: data.text || "", sources: data.sources || [] };
};

export const generateRFQDraft = async (reportData: ComparisonResponse): Promise<string> => {
    const session = getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    const tenantSlug = session?.tenant?.slug || session?.tenant?.id;
    if (tenantSlug && tenantSlug !== 'MASTER') headers['X-Tenant-ID'] = tenantSlug;

    const response = await fetch('/api/ai/rfq', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reportData })
    });

    if (!response.ok) {
        let errMsg = 'Falha ao gerar RFQ.';
        try {
            const err = await response.json();
            errMsg = err.error || errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
    }

    const data = await response.json();
    return data.text || "";
};


import { ComparisonResponse } from "../types";

/**
 * Valida se um objeto desconhecido (vinda da API/JSON) adere à interface ComparisonResponse.
 * Isso atua como um "Type Guard" em tempo de execução.
 */
export const validateComparisonResponse = (data: any): data is ComparisonResponse => {
  if (!data || typeof data !== 'object') {
    console.error("Validation Failed: Root is not an object", data);
    return false;
  }

  if (typeof data.referenceName !== 'string') {
    console.error("Validation Failed: Missing referenceName");
    return false;
  }

  if (!Array.isArray(data.candidates)) {
    console.error("Validation Failed: candidates is not an array");
    return false;
  }

  // Validação profunda dos candidatos
  for (const [index, cand] of data.candidates.entries()) {
    if (typeof cand.productName !== 'string') {
      console.error(`Validation Failed at candidate[${index}]: Missing productName`);
      return false;
    }
    if (typeof cand.totalScore !== 'number') {
      console.error(`Validation Failed at candidate[${index}]: Missing totalScore`);
      return false;
    }
    if (!Array.isArray(cand.attributes)) {
      console.error(`Validation Failed at candidate[${index}]: attributes is not an array`);
      return false;
    }
    
    // Validação de atributos essenciais para a renderização
    for (const [attrIndex, attr] of cand.attributes.entries()) {
        if (!attr.name || !attr.referenceValue) {
            console.error(`Validation Failed at candidate[${index}].attr[${attrIndex}]: Missing name or value`);
            return false;
        }
    }
  }

  return true;
};

/**
 * Tenta corrigir falhas comuns na resposta da IA (ex: string numérica em vez de number)
 */
export const sanitizeResponse = (data: any): ComparisonResponse => {
    // Deep clone simples
    const clean = JSON.parse(JSON.stringify(data));

    if (!clean.referenceName) clean.referenceName = "Produto Desconhecido";
    if (!clean.executiveSummary) clean.executiveSummary = "Resumo não gerado pela IA.";
    if (!Array.isArray(clean.candidates)) clean.candidates = [];

    clean.candidates.forEach((cand: any) => {
        if (typeof cand.totalScore === 'string') cand.totalScore = parseFloat(cand.totalScore) || 0;
        if (!cand.pros) cand.pros = [];
        if (!cand.cons) cand.cons = [];
        if (!cand.attributes) cand.attributes = [];
        
        cand.attributes.forEach((attr: any) => {
            if(typeof attr.matchScore === 'string') attr.matchScore = parseFloat(attr.matchScore) || 0;
            if(!attr.candidateValue) attr.candidateValue = "N/A";
        });
    });

    return clean as ComparisonResponse;
};

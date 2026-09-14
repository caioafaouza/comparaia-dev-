import React from 'react';
import { ComparisonResponse, Tenant } from '../types';
import Logo from './Logo';

interface TechnicalReportTemplateProps {
  data: ComparisonResponse;
  tenant?: Tenant;
  language: string;
  t: (path: string) => string;
  showDiffOnly?: boolean;
}

const normalizePercent = (value: any) => {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(num)) return 0;
  const scaled = num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, scaled));
};

const TechnicalReportTemplate: React.FC<TechnicalReportTemplateProps> = ({ data, tenant, language, t, showDiffOnly = false }) => {
  const sortedCandidates = [...data.candidates].sort((a, b) => b.totalScore - a.totalScore);
  const normalizedLang = String(language || '').toLowerCase();
  const pageLabelMap = {
    pt: { label: 'Página', sep: 'de' },
    en: { label: 'Page', sep: 'of' },
    es: { label: 'Página', sep: 'de' }
  } as const;
  const pageCopy =
    normalizedLang.startsWith('en') ? pageLabelMap.en :
    normalizedLang.startsWith('es') ? pageLabelMap.es :
    pageLabelMap.pt;
  
  // Logic to determine if a row (attribute) has different values across candidates
  const isRowDifferent = (attrName: string) => {
      if (sortedCandidates.length < 2) return true; // Always show if only 1 candidate
      
      const values = sortedCandidates.map(c => {
          const val = c.attributes.find(a => a.name === attrName)?.candidateValue;
          // Normalize for comparison: simple string trim and lowercase
          return val ? val.trim().toLowerCase() : '';
      });

      // Check if all values are identical
      const firstVal = values[0];
      return !values.every(v => v === firstVal);
  };

  // Consolida todos os nomes de atributos únicos, aplicando o filtro se necessário
  let allAttributeNames = Array.from(new Set(sortedCandidates.flatMap(c => c.attributes.map(a => a.name))));
  
  if (showDiffOnly) {
      allAttributeNames = allAttributeNames.filter(name => isRowDifferent(name));
  }

  // Check if we have prices to show
  const hasPrices = sortedCandidates.some(c => c.price && c.price > 0);

  const chunkAttributeNames = (names: string[], firstCount: number, otherCount: number) => {
      const chunks: string[][] = [];
      let index = 0;
      const first = Math.max(1, firstCount);
      const other = Math.max(1, otherCount);
      chunks.push(names.slice(index, index + first));
      index += first;
      while (index < names.length) {
          chunks.push(names.slice(index, index + other));
          index += other;
      }
      return chunks;
  };

  const columnsCount = Math.max(1, sortedCandidates.length);
  const baseFirst = columnsCount <= 2 ? 8 : 6;
  const baseOther = columnsCount <= 2 ? 12 : 10;
  const firstRows = Math.max(5, baseFirst - (hasPrices ? 1 : 0));
  const otherRows = Math.max(8, baseOther);
  const attributeChunks = chunkAttributeNames(allAttributeNames, firstRows, otherRows);
  const firstChunk = attributeChunks[0] || [];
  const otherChunks = attributeChunks.slice(1);
  const totalPages = 2 + otherChunks.length;

  const renderAttributeRows = (names: string[]) => {
      return names.map((attrName) => {
          const refValue = sortedCandidates[0].attributes.find(a => a.name === attrName)?.referenceValue || 'N/A';
          return (
            <tr key={attrName} className="avoid-break">
              <td className="font-bold">{attrName}</td>
              <td className="text-gray" style={{ whiteSpace: 'pre-line' }}>{refValue}</td>
              {sortedCandidates.map((cand, colIdx) => {
                const attr = cand.attributes.find(a => a.name === attrName);
                const isCritical = attr?.requiresVerification;
                const rawValue = attr?.candidateValue ? String(attr.candidateValue) : '';
                const normalizedValue = rawValue.toLowerCase();
                const isMissing = !normalizedValue || normalizedValue.includes('não especificado') || normalizedValue === 'n/a';
                return (
                  <td key={colIdx} style={{ backgroundColor: isCritical ? '#fef2f2' : 'transparent' }}>
                    {isMissing ? (
                        <span className="text-gray text-xs block py-1">— Não consta no documento —</span>
                    ) : (
                        <span className={isCritical ? 'text-red' : ''} style={{ whiteSpace: 'pre-line' }}>{rawValue}</span>
                    )}
                    {isCritical && (
                        <div className="text-red text-[7pt] mt-1 uppercase border-t border-red-200 pt-1">
                            ⚠ Desvio Crítico
                        </div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
      });
  };

  return (
    <div id="pdf-report-template" className="pdf-safe bg-white text-slate-900 font-sans text-[10pt] leading-normal w-[297mm] mx-auto">
      <style data-pdf-template-style="true">{`
        /* PDF safety: override Tailwind v4 oklch colors with RGB to keep html2canvas happy */
        .pdf-safe {
          color: #0f172a !important;
          background-color: #ffffff !important;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          line-height: 1.5;
          width: 297mm;
          margin: 0 auto;
        }
        .pdf-safe, .pdf-safe * { box-sizing: border-box; }
        .pdf-safe * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pdf-safe .bg-white { background-color: #ffffff !important; }
        .pdf-safe .bg-slate-50 { background-color: #f8fafc !important; }
        .pdf-safe .bg-slate-900 { background-color: #0f172a !important; }
        .pdf-safe .bg-green-50 { background-color: #f0fdf4 !important; }
        .pdf-safe .bg-price { background-color: #f0fdf4 !important; }
        .pdf-safe .text-white { color: #ffffff !important; }
        .pdf-safe .text-slate-900 { color: #0f172a !important; }
        .pdf-safe .text-slate-700 { color: #334155 !important; }
        .pdf-safe .text-slate-600 { color: #475569 !important; }
        .pdf-safe .text-slate-500 { color: #64748b !important; }
        .pdf-safe .text-slate-400 { color: #94a3b8 !important; }
        .pdf-safe .text-green-900 { color: #14532d !important; }
        .pdf-safe .text-green-800 { color: #166534 !important; }
        .pdf-safe .text-green-700 { color: #15803d !important; }
        .pdf-safe .text-green { color: #16a34a !important; }
        .pdf-safe .text-red { color: #dc2626 !important; }
        .pdf-safe .text-gray { color: #64748b !important; }
        .pdf-safe .border-slate-100 { border-color: #f1f5f9 !important; }
        .pdf-safe .border-slate-200 { border-color: #e2e8f0 !important; }
        .pdf-safe .border-slate-300 { border-color: #cbd5e1 !important; }
        .pdf-safe .border-slate-400 { border-color: #94a3b8 !important; }
        .pdf-safe .border-slate-900 { border-color: #0f172a !important; }
        .pdf-safe .border-green-600 { border-color: #16a34a !important; }
        .pdf-safe .border-red-200 { border-color: #fecaca !important; }
        .pdf-safe tr:nth-child(even) td { background-color: #f8fafc !important; }

        .pdf-container { width: 100%; box-sizing: border-box; }
        .pdf-page {
          width: 297mm;
          height: 210mm;
          padding: 16mm 16mm 14mm 16mm;
          margin: 0 auto;
          background: #ffffff;
          page-break-after: always;
        }
        .pdf-page:last-child { page-break-after: auto; }
        .page-break { page-break-before: always; }
        .avoid-break { page-break-inside: avoid; }
        
        /* Tabelas Print-Friendly */
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
        th { background-color: #f1f5f9 !important; color: #0f172a !important; font-weight: 800; text-transform: uppercase; padding: 8px; border: 1px solid #cbd5e1; font-size: 8pt; -webkit-print-color-adjust: exact; }
        td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 9pt; }
        tr:nth-child(even) td { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
        
        /* Helpers */
        .text-xs { font-size: 8pt; }
        .text-sm { font-size: 10pt; }
        .text-lg { font-size: 14pt; }
        .text-xl { font-size: 16pt; }
        .text-2xl { font-size: 20pt; }
        .text-4xl { font-size: 32pt; }
        .text-\\[7pt\\] { font-size: 7pt; }
        .text-\\[8pt\\] { font-size: 8pt; }
        .font-bold { font-weight: 700; }
        .font-black { font-weight: 900; }
        .uppercase { text-transform: uppercase; }
        .italic { font-style: italic; }
        .tracking-tight { letter-spacing: -0.01em; }
        .tracking-widest { letter-spacing: 0.1em; }
        .text-red { color: #dc2626; font-weight: bold; }
        .text-green { color: #16a34a; font-weight: bold; }
        .text-gray { color: #64748b; font-style: italic; }
        .bg-price { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; }

        /* Layout utilities (Tailwind-like) */
        .flex { display: flex; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .justify-between { justify-content: space-between; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .gap-3 { gap: 12px; }
        .gap-4 { gap: 16px; }
        .w-10 { width: 40px; }
        .h-10 { height: 40px; }
        .w-3\\/4 { width: 75%; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .block { display: block; }
        .list-disc { list-style-type: disc; }
        .list-inside { list-style-position: inside; }

        /* Spacing */
        .p-4 { padding: 16px; }
        .p-2 { padding: 8px; }
        .pl-4 { padding-left: 16px; }
        .pb-4 { padding-bottom: 16px; }
        .pb-2 { padding-bottom: 8px; }
        .pt-4 { padding-top: 16px; }
        .pt-1 { padding-top: 4px; }
        .py-1 { padding-top: 4px; padding-bottom: 4px; }
        .mb-1 { margin-bottom: 4px; }
        .mb-2 { margin-bottom: 8px; }
        .mb-3 { margin-bottom: 12px; }
        .mb-4 { margin-bottom: 16px; }
        .mb-6 { margin-bottom: 24px; }
        .mb-8 { margin-bottom: 32px; }
        .mt-1 { margin-top: 4px; }
        .mt-8 { margin-top: 32px; }

        /* Borders */
        .border { border-width: 1px; border-style: solid; }
        .border-2 { border-width: 2px; border-style: solid; }
        .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
        .border-b-2 { border-bottom-width: 2px; border-bottom-style: solid; }
        .border-t { border-top-width: 1px; border-top-style: solid; }
        .border-l-4 { border-left-width: 4px; border-left-style: solid; }
        .rounded { border-radius: 6px; }
        .rounded-t { border-top-left-radius: 6px; border-top-right-radius: 6px; }
      `}</style>

      <div className="pdf-container">

        <div className="pdf-page">
          <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <Logo className="w-10 h-10" variant="color" />
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight">Relatório de Homologação Técnica</h1>
                {showDiffOnly && (
                  <p className="text-xs text-slate-500">(Modo: Apenas Diferen?as)</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">{tenant?.name || 'Organização'}</div>
              <div className="text-xs text-slate-500">{new Date().toLocaleString()}</div>
              <div className="text-xs text-slate-500">{pageCopy.label} 1 {pageCopy.sep} {totalPages}</div>
            </div>
          </div>

          <div className="mb-8 avoid-break border border-slate-200 rounded p-4 bg-slate-50">
             <h2 className="text-sm font-bold uppercase text-slate-500 mb-2">Item de Referência</h2>
             <div className="text-xl font-black text-slate-900 mb-2">{data.referenceName}</div>
             <div className="text-sm italic text-slate-700 border-l-4 border-slate-400 pl-3">
               "{data.executiveSummary}"
             </div>
          </div>

          <div className="mb-8 p-4 border-2 border-green-600 bg-green-50 rounded avoid-break flex justify-between items-center">
              <div>
                  <span className="text-xs font-bold text-green-800 uppercase tracking-widest">Melhor Escolha Técnica</span>
                  <div className="text-2xl font-black text-green-900">{sortedCandidates[0].productName}</div>
              </div>
              <div className="text-right">
                  <div className="text-4xl font-black text-green-700">{normalizePercent(sortedCandidates[0].totalScore).toFixed(0)}%</div>
                  <div className="text-xs font-bold text-green-800 uppercase">Score de Aderência</div>
              </div>
          </div>

          <h3 className="text-lg font-bold mb-4 bg-slate-900 text-white p-2 pl-4 rounded-t">1. Matriz Técnica Detalhada</h3>
          
          <table>
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Parâmetro (Referência)</th>
                <th style={{ width: '25%' }}>Especificação Exigida</th>
                {sortedCandidates.map((c, i) => (
                  <th key={i}>
                    {c.productName}
                    <div style={{ fontSize: '7pt', fontWeight: 'normal', marginTop: '2px' }}>
                      {i === 0 ? '(VENCEDOR)' : '(CANDIDATO)'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasPrices && (
                  <tr className="avoid-break" style={{ borderBottom: '2px solid #0f172a' }}>
                      <td className="font-bold uppercase text-green">Avaliação Financeira</td>
                      <td className="text-gray text-xs">Valores Estimados / ROI</td>
                      {sortedCandidates.map((c, i) => {
                          const price = c.price || 0;
                          const score = normalizePercent(c.totalScore);
                          const roi = price > 0 ? (score / (price/1000)).toFixed(1) : 0;
                          
                          return (
                              <td key={i} className="bg-price">
                                  <div className="font-black text-slate-900">
                                      {price > 0 ? `R$ ${price.toLocaleString()}` : 'N/A'}
                                  </div>
                                  {price > 0 && (
                                      <div className="text-[8pt] text-green font-bold mt-1">
                                          ROI: {roi} pts/kR$
                                      </div>
                                  )}
                              </td>
                          );
                      })}
                  </tr>
              )}

              {renderAttributeRows(firstChunk)}
            </tbody>
          </table>
        </div>

        {otherChunks.map((chunk, pageIndex) => {
          const pageNumber = pageIndex + 2;
          return (
          <div key={pageIndex} className="pdf-page">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-slate-400">Continuação da Matriz Técnica</div>
              <div className="text-xs text-slate-400">{pageCopy.label} {pageNumber} {pageCopy.sep} {totalPages}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Parâmetro (Referência)</th>
                  <th style={{ width: '25%' }}>Especificação Exigida</th>
                  {sortedCandidates.map((c, i) => (
                    <th key={i}>
                      {c.productName}
                      <div style={{ fontSize: '7pt', fontWeight: 'normal', marginTop: '2px' }}>
                        {i === 0 ? '(VENCEDOR)' : '(CANDIDATO)'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderAttributeRows(chunk)}
              </tbody>
            </table>
          </div>
        )})}

        <div className="pdf-page">
          <div className="text-right text-xs text-slate-400 mb-2">{pageCopy.label} {totalPages} {pageCopy.sep} {totalPages}</div>
          <h3 className="text-lg font-bold mb-4 bg-slate-900 text-white p-2 pl-4 rounded-t">2. Parecer Técnico Individual</h3>
          <div className="grid grid-cols-2 gap-4">
              {sortedCandidates.map((c, i) => (
                  <div key={i} className="border border-slate-300 rounded p-4 avoid-break bg-white">
                      <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                          <div className="font-bold text-lg w-3/4">{c.productName}</div>
                          <div className="font-black text-xl">{normalizePercent(c.totalScore).toFixed(0)}%</div>
                      </div>
                      
                      <p className="text-xs italic text-slate-600 mb-4 bg-slate-50 p-2 rounded">"{c.reasoning}"</p>
                      
                      <div className="mb-3">
                          <div className="text-xs font-bold uppercase text-green mb-1">Pontos Fortes</div>
                          <ul className="list-disc list-inside text-xs">
                              {c.pros?.slice(0,4).map((p, idx) => <li key={idx}>{p}</li>)}
                          </ul>
                      </div>
                      
                      {c.cons && c.cons.length > 0 && (
                          <div>
                              <div className="text-xs font-bold uppercase text-red mb-1">Pontos de Atenção</div>
                              <ul className="list-disc list-inside text-xs">
                                  {c.cons.slice(0,4).map((p, idx) => <li key={idx}>{p}</li>)}
                              </ul>
                          </div>
                      )}
                  </div>
              ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TechnicalReportTemplate;

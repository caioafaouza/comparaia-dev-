
import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label } from 'recharts';
import { ComparisonResponse, Tenant } from '../types';
import { generateRFQDraft } from '../services/geminiService';
import { downloadJobReportPdf, updateJobPrices } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import ComparisonChat from './ComparisonChat';
import TechnicalReportTemplate from './TechnicalReportTemplate';
import Logo from './Logo';

interface ComparisonResultProps {
    data: ComparisonResponse;
    jobId?: string;
    onReset: () => void;
    tenant?: Tenant;
}

const normalizePercent = (value: any) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(num)) return 0;
    const scaled = num <= 1 ? num * 100 : num;
    return Math.max(0, Math.min(100, scaled));
};

const ComparisonResult: React.FC<ComparisonResultProps> = ({ data: initialData, jobId, onReset, tenant }) => {
    const { addToast } = useToast();
    const { t, language } = useLanguage();
    const reportRef = useRef<HTMLDivElement>(null);
    const priceSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ensureHtml2Pdf = async () => {
        // @ts-ignore - html2pdf is loaded via global script
        if (window.html2pdf) return;

        await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById('html2pdf-js') as HTMLScriptElement | null;
            if (existing) {
                if ((window as any).html2pdf) return resolve();
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Falha ao carregar html2pdf')));
                return;
            }

            const script = document.createElement('script');
            script.id = 'html2pdf-js';
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar html2pdf'));
            document.body.appendChild(script);
        });
    };
    const ensureHtml2Canvas = async () => {
        // @ts-ignore - html2canvas may be exposed by html2pdf bundle
        if (window.html2canvas) return;
        await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById('html2canvas-js') as HTMLScriptElement | null;
            if (existing) {
                // @ts-ignore
                if ((window as any).html2canvas) return resolve();
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Falha ao carregar html2canvas')));
                return;
            }
            const script = document.createElement('script');
            script.id = 'html2canvas-js';
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar html2canvas'));
            document.body.appendChild(script);
        });
    };
    const ensureJsPDF = async () => {
        // @ts-ignore - jsPDF may be exposed by html2pdf bundle
        if ((window as any).jspdf?.jsPDF || (window as any).jsPDF) return;
        await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById('jspdf-js') as HTMLScriptElement | null;
            if (existing) {
                if ((window as any).jspdf?.jsPDF || (window as any).jsPDF) return resolve();
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Falha ao carregar jsPDF')));
                return;
            }
            const script = document.createElement('script');
            script.id = 'jspdf-js';
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar jsPDF'));
            document.body.appendChild(script);
        });
    };
    const waitForAssets = async (container: HTMLElement) => {
        const images = Array.from(container.querySelectorAll('img'));
        const imagePromises = images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
                const done = () => {
                    img.removeEventListener('load', done);
                    img.removeEventListener('error', done);
                    resolve();
                };
                img.addEventListener('load', done);
                img.addEventListener('error', done);
            });
        });

        const fontReady = (document as any).fonts?.ready;
        await Promise.all([
            fontReady?.catch(() => null),
            ...imagePromises
        ]);
    };
    // Adapter for Legacy Data Structure (DB Mismatch Fix)
    const normalizeData = (rawData: any): ComparisonResponse => {
        // If it already has candidates, return as is
        if (rawData?.candidates && Array.isArray(rawData.candidates)) {
            return rawData;
        }

        // If it looks like the Legacy JSON found in DB
        if (rawData?.CandidateProduct && Array.isArray(rawData.CandidateProduct)) {
            console.warn('Legacy Data Structure Detected. Normalizing...');

            const newCandidates = rawData.CandidateProduct.map((legacyCand: any) => {
                // Extract attributes from the "Comparison" array if available, 
                // relying on the candidate name match or just mapping everything if single candidate.
                // For simplicity in this fix, we map the "Specification" object directly to attributes.

                const attributes = [];
                if (legacyCand.Specification) {
                    for (const [key, val] of Object.entries(legacyCand.Specification)) {
                        attributes.push({
                            name: key,
                            candidateValue: String(val),
                            referenceValue: 'N/A', // Legacy structure might strictly separate ref value
                            matchScore: 0.5, // Default for legacy
                            requiresVerification: false,
                            confidenceScore: 0.8
                        });
                    }
                }

                // Try to enrich attributes from the "Comparison" array
                if (rawData.Comparison && Array.isArray(rawData.Comparison)) {
                    rawData.Comparison.forEach((comp: any) => {
                        // Check if this comparison row applies to this candidate (or if it's a global list)
                        // The legacy JSON showed "Candidate": "Aço Inox 304" in the comparison row.
                        if (comp.Candidate === legacyCand.Candidate || rawData.CandidateProduct.length === 1) {
                            const existingAttr = attributes.find(a => a.name === comp.Characteristic);
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
                                    confidenceScore: 1
                                });
                            }
                        }
                    });
                }

                return {
                    productName: legacyCand.Candidate || 'Produto Candidato',
                    isRecommended: false, // Legacy didn't have this explicitly?
                    totalScore: 0.5,
                    pros: [],
                    cons: [],
                    attributes: attributes,
                    reasoning: "Dados migrados de versão anterior.",
                    price: 0
                };
            });

            return {
                ...rawData,
                referenceName: rawData.ReferenceProduct?.Reference || 'Referência Migrada',
                candidates: newCandidates,
                executiveSummary: "Relatório adaptado do formato antigo."
            };
        }

        return rawData;
    };

    const [data, setData] = useState<ComparisonResponse>(() => normalizeData(initialData));
    const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');
    const [showDiffOnly, setShowDiffOnly] = useState(false);
    const [activeCommentRow, setActiveCommentRow] = useState<string | null>(null);
    const [isGeneratingRFQ, setIsGeneratingRFQ] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    // State for Prices (editable)
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [pricesTouched, setPricesTouched] = useState(false);

    // Initialize prices from data
    useEffect(() => {
        // Reset touch flag when we switch jobs
        setPricesTouched(false);
    }, [jobId]);

    useEffect(() => {
        if (pricesTouched) return;
        const initialPrices: Record<string, number> = {};
        if (initialData?.candidates) {
            initialData.candidates.forEach(c => {
                initialPrices[c.productName] = c.price || 0;
            });
        }
        setPrices(initialPrices);
    }, [initialData, pricesTouched]);

    // Persist prices for server-side PDF/report (debounced)
    useEffect(() => {
        if (!jobId) return;
        if (!data?.candidates || data.candidates.length === 0) return;

        if (priceSyncTimer.current) {
            clearTimeout(priceSyncTimer.current);
        }

        priceSyncTimer.current = setTimeout(async () => {
            try {
                await updateJobPrices(jobId, prices);
            } catch (err) {
                // Silent fail to avoid UX noise; PDF download still attempts to sync on demand
                console.warn('Price sync failed', err);
            }
        }, 600);

        return () => {
            if (priceSyncTimer.current) {
                clearTimeout(priceSyncTimer.current);
                priceSyncTimer.current = null;
            }
        };
    }, [jobId, prices, data?.candidates]);

    const handlePriceChange = (productName: string, val: string) => {
        const normalized = val.replace(/[^0-9,.-]/g, '').replace(',', '.');
        const num = parseFloat(normalized);
        setPrices(prev => ({
            ...prev,
            [productName]: isNaN(num) ? 0 : num
        }));
        setPricesTouched(true);
    };

    const sortedCandidates = useMemo(() => {
        if (!data.candidates) return [];
        return [...data.candidates].sort((a, b) => b.totalScore - a.totalScore);
    }, [data.candidates]);

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

    const allAttributeNames = useMemo(() => {
        const names = new Set<string>();
        sortedCandidates.forEach(c => c.attributes?.forEach(a => names.add(a.name)));
        const allNames = Array.from(names);

        if (showDiffOnly) {
            return allNames.filter(name => isRowDifferent(name));
        }
        return allNames;
    }, [sortedCandidates, showDiffOnly]);

    // Chart Data Preparation
    const chartData = useMemo(() => {
        return sortedCandidates.map(c => ({
            name: c.productName,
            score: Math.round(normalizePercent(c.totalScore)),
            price: prices[c.productName] || 0,
            isWinner: c.isRecommended
        }));
    }, [sortedCandidates, prices]);

    const hasPrices = chartData.some(d => d.price > 0);

    // Calculate Chart Domain (with some padding)
    const maxPrice = Math.max(...chartData.map(d => d.price), 1000) * 1.1;

    const handleShare = async () => {
        try {
            const shareUrl = `${window.location.origin}/share/report-${jobId || 'demo-' + Math.random().toString(36).substr(2, 5)}`;
            await navigator.clipboard.writeText(shareUrl);
            addToast(t('common.copied'), "success");
        } catch (err) {
            addToast(t('common.error'), "error");
        }
    };

    const handleDownloadPDF = async () => {
        if (isGeneratingPDF) return;
        setIsGeneratingPDF(true);
        addToast("Gerando Relatório Técnico Padrão...", "info");

        const fileName = `Relatorio_Tecnico_${data.referenceName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const downloadBlob = (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const generatePdfLocally = async () => {
            const printContainer = document.createElement('div');
            printContainer.style.position = 'absolute';
            printContainer.style.left = '-9999px';
            printContainer.style.top = '0';
            printContainer.style.width = '297mm';
            document.body.appendChild(printContainer);

            const root = ReactDOM.createRoot(printContainer);
            const dataWithPrices = {
                ...data,
                candidates: data.candidates.map(c => ({
                    ...c,
                    price: prices[c.productName] || c.price
                }))
            };

            root.render(
                <TechnicalReportTemplate
                    data={dataWithPrices}
                    tenant={tenant}
                    language={language}
                    t={t}
                    showDiffOnly={showDiffOnly}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 1000));
            const element = printContainer.querySelector('#pdf-report-template');
            if (!element) throw new Error('pdf_template_missing');
            await waitForAssets(printContainer);

            try {
                await ensureHtml2Pdf();
                await ensureHtml2Canvas();
                await ensureJsPDF();

                // @ts-ignore
                const html2canvas = (window as any).html2canvas;
                // @ts-ignore
                const JsPDFClass = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
                if (!html2canvas || !JsPDFClass) {
                    throw new Error('pdf_runtime_not_loaded');
                }

                const pages = Array.from(element.querySelectorAll('.pdf-page')) as HTMLElement[];
                const targetPages = pages.length > 0 ? pages : [element as HTMLElement];
                const pdf = new JsPDFClass({ unit: 'mm', format: 'a4', orientation: 'landscape' });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                for (let i = 0; i < targetPages.length; i++) {
                    const page = targetPages[i];
                    const rect = page.getBoundingClientRect();
                    const canvas = await html2canvas(page, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        windowWidth: Math.ceil(rect.width),
                        windowHeight: Math.ceil(rect.height),
                        scrollY: 0,
                        onclone: (clonedDoc: Document) => {
                            clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
                            clonedDoc.querySelectorAll('style').forEach((style) => {
                                if (!style.hasAttribute('data-pdf-template-style')) {
                                    style.remove();
                                }
                            });
                        }
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.98);
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    if (i < targetPages.length - 1) {
                        pdf.addPage();
                    }
                }

                pdf.save(fileName);
            } finally {
                setTimeout(() => {
                    root.unmount();
                    document.body.removeChild(printContainer);
                }, 1000);
            }
        };

        try {
            if (jobId) {
                try {
                    await updateJobPrices(jobId, prices);
                    const blob = await downloadJobReportPdf(jobId, showDiffOnly);
                    downloadBlob(blob);
                    addToast("Relatório baixado com sucesso!", "success");
                    return;
                } catch (err) {
                    console.error("PDF Export Backend Failure:", err);
                    addToast("Falha no servidor de PDF. Gerando localmente...", "info");
                }
            }

            await generatePdfLocally();
            addToast("Relatório baixado com sucesso!", "success");
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("PDF Export Failure:", err);
            if (message === 'html2pdf_not_loaded' || message === 'pdf_runtime_not_loaded') {
                addToast("Falha ao carregar a biblioteca de PDF.", "error");
            } else if (message === 'pdf_template_missing') {
                addToast("Erro ao processar modelo de layout.", "error");
            } else if (message.toLowerCase().includes('tainted') || message.toLowerCase().includes('cors')) {
                addToast("Erro no PDF: imagem bloqueada por CORS.", "error");
            } else {
                addToast("Erro na geração do arquivo PDF.", "error");
            }
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleGenerateRFQ = async () => {

        if (isGeneratingRFQ) return;
        setIsGeneratingRFQ(true);
        try {
            const draft = await generateRFQDraft(data);
            const blob = new Blob([draft], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RFQ_${data.referenceName.replace(/\s/g, '_')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast(t('matrix.generateRfq') + " " + t('common.success'), "success");
        } catch (err) {
            addToast(t('common.error'), "error");
        } finally {
            setIsGeneratingRFQ(false);
        }
    };

    const handleAddComment = (attrName: string, text: string) => {
        if (!text.trim()) return;
        addToast(t('matrix.engineeringNote'), "success");
        setActiveCommentRow(null);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs">
                    <p className="font-bold mb-1 text-sm">{data.name}</p>
                    <p className="text-emerald-400">Score: {data.score}%</p>
                    <p className="text-indigo-300">Preço: {data.price > 0 ? `R$ ${data.price.toLocaleString()}` : 'N/A'}</p>
                    <p className="text-slate-400 mt-1 italic">
                        {data.price > 0 ? (data.score / (data.price / 1000)).toFixed(1) + ' pts/kR$' : ''}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (sortedCandidates.length === 0) return <div className="p-20 text-center text-slate-400">{t('jobs.empty')}</div>;

    return (
        <div className="relative flex flex-col gap-8 animate-fade-in pb-32">

            {/* Barra de Ações Superior */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-slate-200 sticky top-4 z-[70] gap-4 transition-all no-print">
                <div className="flex bg-slate-100 p-1 rounded-2xl items-center gap-1">
                    <button onClick={() => setViewMode('matrix')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'matrix' ? 'bg-white text-indigo-900 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>
                        {t('matrix.technicalMatrix')}
                    </button>
                    <button onClick={() => setViewMode('cards')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'cards' ? 'bg-white text-indigo-900 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>
                        {t('matrix.executiveCards')}
                    </button>

                    {/* DIFF VIEW TOGGLE */}
                    {viewMode === 'matrix' && (
                        <div className="h-6 w-px bg-slate-300 mx-2"></div>
                    )}
                    {viewMode === 'matrix' && (
                        <button
                            onClick={() => setShowDiffOnly(!showDiffOnly)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${showDiffOnly ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            {t('matrix.showDiffOnly')}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleShare}
                        className="group flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-2xl text-xs font-black border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                    >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        {t('matrix.share')}
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPDF}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all border border-slate-200 font-black text-xs ${isGeneratingPDF ? 'bg-slate-100 text-slate-400 animate-pulse cursor-not-allowed' : 'text-slate-600 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'}`}
                    >
                        {isGeneratingPDF ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                {t('common.loading')}
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                {t('matrix.downloadPdf')}
                            </>
                        )}
                    </button>

                    <div className="h-8 w-px bg-slate-200 mx-1"></div>

                    <button
                        onClick={handleGenerateRFQ}
                        disabled={isGeneratingRFQ}
                        className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-xs font-black hover:bg-slate-800 transition-all shadow-xl hover:shadow-indigo-500/20 active:scale-95 text-center leading-tight uppercase flex items-center gap-2 disabled:opacity-50"
                    >
                        {isGeneratingRFQ ? (
                            <>
                                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                {t('common.loading')}
                            </>
                        ) : (
                            t('matrix.generateRfq')
                        )}
                    </button>
                </div>
            </div>

            <div ref={reportRef} className="space-y-10 p-4 bg-white rounded-3xl">

                {/* Header Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-1000"><Logo className="w-64 h-64" variant="white" /></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20">Decision Insight</span>
                                <div className="h-px w-20 bg-indigo-50/20"></div>
                            </div>
                            <h3 className="text-4xl font-black mb-6 tracking-tight leading-tight">{data.referenceName}</h3>
                            <p className="text-indigo-100 text-xl leading-relaxed italic border-l-4 border-indigo-400 pl-8 py-2 max-w-3xl">
                                "{data.executiveSummary}"
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-4 bg-white rounded-[2.5rem] p-10 border-2 border-emerald-500 shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">{t('matrix.suggestedWinner')}</div>
                        <div className="text-3xl font-black text-slate-900 mb-2 leading-tight px-4">{sortedCandidates[0].productName}</div>
                        <div className="flex items-baseline gap-1 mt-2">
                            <div className="text-6xl font-black text-emerald-600">
                                {normalizePercent(sortedCandidates[0].totalScore).toFixed(0)}
                            </div>
                            <div className="text-xl font-black text-emerald-400">%</div>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-4 tracking-wider">{t('matrix.adherence')}</div>
                    </div>
                </div>

                {/* --- SCATTER PLOT SECTION --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                Matriz de Decisão: Custo x Benefício
                            </h3>
                            {!hasPrices && (
                                <span className="text-[10px] bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full border border-yellow-200 font-bold animate-pulse">
                                    Aguardando inputs de preço...
                                </span>
                            )}
                        </div>

                        <div className="h-[300px] w-full relative">
                            {!hasPrices && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 backdrop-blur-sm">
                                    <p className="text-slate-400 font-bold text-sm">Insira os preços ao lado para gerar o gráfico</p>
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%" minHeight={240} minWidth={240}>
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" dataKey="price" name="Preço" unit=" R$" domain={[0, 'auto']} label={{ value: 'Investimento (R$)', position: 'bottom', offset: 0, fontSize: 10, fill: '#64748b' }} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis type="number" dataKey="score" name="Score" unit="%" domain={[0, 100]} label={{ value: 'Performance Técnica (%)', angle: -90, position: 'left', offset: 0, fontSize: 10, fill: '#64748b' }} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <ZAxis type="number" range={[100, 400]} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                                    <Scatter name="Candidatos" data={chartData} fill="#4f46e5">
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.isWinner ? '#10b981' : '#4f46e5'} />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex gap-6 justify-center text-[10px] uppercase font-bold text-slate-400">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Melhor Opção</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-600"></div> Outros</div>
                        </div>
                    </div>

                    {/* Price Inputs Panel */}
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 shadow-inner flex flex-col">
                        <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Simulação de Propostas</h4>
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                            {sortedCandidates.map((c, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`text-xs font-bold ${c.isRecommended ? 'text-emerald-600' : 'text-slate-700'} truncate w-2/3`} title={c.productName}>{c.productName}</span>
                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">{normalizePercent(c.totalScore).toFixed(0)}%</span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">R$</span>
                                        <input
                                            type="number"
                                            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                                            placeholder="0.00"
                                            value={prices[c.productName] || ''}
                                            onChange={(e) => handlePriceChange(c.productName, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200 text-center">
                            <p className="text-[10px] text-slate-400 leading-tight">
                                Ajuste os valores para recalcular o gráfico de Custo x Benefício em tempo real.
                            </p>
                        </div>
                    </div>
                </div>

                {viewMode === 'matrix' ? (
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden relative">
                        <div className="overflow-x-auto custom-scrollbar max-h-[650px] overscroll-x-contain">
                            <table className="w-full text-left border-separate border-spacing-0 min-w-max table-fixed">
                                <thead className="relative z-[60]">
                                    <tr className="bg-slate-900 text-white">
                                        {/* HEADER FIXO: TOP-LEFT CORNER */}
                                        <th className="p-3 md:p-6 border-r border-slate-800 w-[140px] md:w-[280px] sticky left-0 top-0 bg-slate-900 z-[65] shadow-[4px_4px_10px_-2px_rgba(0,0,0,0.4)]">
                                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{t('matrix.specParam')}</span>
                                        </th>
                                        {/* HEADER FIXO: VERTICAL APENAS */}
                                        <th className="p-3 md:p-6 border-r border-slate-800 w-[240px] md:w-[280px] sticky top-0 bg-slate-800 z-[55] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3)]">
                                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{t('matrix.requestedRef')}</span>
                                        </th>
                                        {sortedCandidates.map((c, i) => (
                                            <th key={i} className={`p-3 md:p-6 border-r border-slate-800 min-w-[200px] md:min-w-[320px] sticky top-0 z-[55] relative transition-all shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3)] ${i === 0 ? 'bg-indigo-900' : 'bg-slate-900 hover:bg-slate-800'}`}>
                                                {i === 0 && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400"></div>}
                                                <div className="flex flex-col gap-1">
                                                    <span className="truncate text-xs md:text-sm font-black tracking-tight" title={c.productName}>{c.productName}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${normalizePercent(c.totalScore) > 85 ? 'bg-emerald-500' : 'bg-indigo-600'}`}>
                                                            {normalizePercent(c.totalScore).toFixed(0)}% Match
                                                        </span>
                                                        {i === 0 && <span className="text-[9px] text-emerald-400 font-black animate-pulse hidden md:inline">{t('matrix.winner')}</span>}
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {allAttributeNames.length === 0 ? (
                                        <tr>
                                            <td colSpan={2 + sortedCandidates.length} className="p-8 text-center text-slate-400 italic">
                                                Nenhuma diferença encontrada entre os candidatos.
                                            </td>
                                        </tr>
                                    ) : (
                                        allAttributeNames.map((attrName, rowIdx) => (
                                            <tr key={rowIdx} className="hover:bg-indigo-50/40 transition-colors group/row">
                                                {/* COLUNA FIXA: ESQUERDA */}
                                                <td className="p-3 md:p-6 font-bold text-slate-800 bg-slate-50 border-r border-slate-200 sticky left-0 z-[40] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] text-[10px] md:text-xs uppercase leading-snug align-middle">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className="pr-1 md:pr-4 line-clamp-3 md:line-clamp-none">{attrName}</span>
                                                        <button
                                                            onClick={() => setActiveCommentRow(activeCommentRow === attrName ? null : attrName)}
                                                            className="opacity-0 group-hover/row:opacity-100 p-1 md:p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-all shadow-sm bg-white border border-slate-100 flex-shrink-0 no-print hidden md:block"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-3 md:p-6 text-[10px] md:text-xs text-slate-600 border-r border-slate-100 bg-white italic font-medium leading-relaxed z-10">
                                                    {sortedCandidates[0].attributes.find(a => a.name === attrName)?.referenceValue || 'N/A'}
                                                </td>
                                                {sortedCandidates.map((cand, colIdx) => {
                                                    const attr = cand.attributes.find(a => a.name === attrName);
                                                    const isCritical = attr?.requiresVerification;
                                                    const mScore = attr ? normalizePercent(attr.matchScore) : 0;

                                                    return (
                                                        <td key={colIdx} className={`p-3 md:p-6 text-[10px] md:text-xs border-r border-slate-100 relative z-10 ${isCritical ? 'bg-red-50/60' : 'bg-white group-hover/row:bg-transparent'}`}>
                                                            <div className="flex flex-col gap-2 md:gap-3">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <span className={`font-black text-xs md:text-sm leading-tight ${isCritical ? 'text-red-700' : 'text-slate-900'}`}>
                                                                        {attr?.candidateValue || 'N/A'}
                                                                    </span>
                                                                    {isCritical && (
                                                                        <div className="shrink-0 flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-red-600 text-white rounded-full font-black animate-pulse text-[9px] md:text-[10px]" title={t('matrix.riskIdentified')}>!</div>
                                                                    )}
                                                                </div>
                                                                {attr && (
                                                                    <div className="flex items-center gap-2 md:gap-3">
                                                                        <div className="flex-1 bg-slate-100 rounded-full h-1 md:h-1.5 overflow-hidden shadow-inner">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-[1500ms] ${mScore > 80 ? 'bg-emerald-500' : mScore > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                                style={{ width: `${mScore}%` }}
                                                                            ></div>
                                                                        </div>
                                                                        <span className="text-[8px] md:text-[9px] font-black text-slate-400 tabular-nums">{mScore.toFixed(0)}%</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {sortedCandidates.map((c, i) => (
                            <div key={i} className={`p-10 rounded-[2.5rem] border-2 transition-all duration-500 group relative page-break-avoid ${c.isRecommended ? 'bg-indigo-50/50 border-indigo-500 shadow-2xl ring-[12px] ring-indigo-500/5' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm hover:shadow-xl'}`}>
                                {c.isRecommended && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">{t('matrix.recommended')}</div>
                                )}
                                <div className="flex justify-between items-start mb-8">
                                    <h3 className="font-black text-slate-900 text-2xl leading-tight pr-6">{c.productName}</h3>
                                    <div className={`text-4xl font-black italic tracking-tighter ${normalizePercent(c.totalScore) > 85 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                        {normalizePercent(c.totalScore).toFixed(0)}%
                                    </div>
                                </div>
                                <p className="text-sm text-slate-500 mb-10 line-clamp-5 leading-relaxed italic border-l-2 border-slate-200 pl-4 group-hover:border-indigo-400 transition-colors">"{c.reasoning}"</p>

                                <div className="space-y-8">
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <span className="w-4 h-px bg-emerald-200"></span> {t('matrix.strengths')}
                                        </div>
                                        <ul className="text-xs text-slate-700 space-y-4">
                                            {c.pros?.map((p, idx) => (<li key={idx} className="flex gap-3 items-start"><span className="text-emerald-500 font-black shrink-0">✓</span> {p}</li>))}
                                        </ul>
                                    </div>
                                    {c.cons?.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                <span className="w-4 h-px bg-red-200"></span> {t('matrix.gaps')}
                                            </div>
                                            <ul className="text-xs text-slate-500 space-y-4">
                                                {c.cons.map((p, idx) => (<li key={idx} className="flex gap-3 items-start"><span className="text-red-500 font-black shrink-0">✕</span> {p}</li>))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {activeCommentRow && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-900 p-8 border-t-4 border-indigo-500 animate-slide-up text-white z-[80] shadow-2xl no-print">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center font-black">@</div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">{t('matrix.engineeringNote')}</h4>
                                    <p className="text-sm font-bold text-white">{activeCommentRow}</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveCommentRow(null)} className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">{t('common.close')}</button>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <textarea
                                className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 placeholder:text-slate-600 transition-all shadow-inner resize-none"
                                placeholder="Escreva sua observação técnica..."
                                rows={2}
                            />
                            <button
                                onClick={() => handleAddComment(activeCommentRow, 'OK')}
                                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95 whitespace-nowrap"
                            >
                                {t('matrix.registerNote')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="no-print">
                <ComparisonChat reportData={data} />
            </div>
        </div>
    );
};

export default ComparisonResult;



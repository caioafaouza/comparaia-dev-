
import React, { useRef, useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface FileUploaderProps {
  label: string;
  files: File[];
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  directory?: boolean; 
  accept?: string;
  helperText?: string;
  variant?: 'primary' | 'secondary';
  selectionMode?: 'none' | 'single';
  selectedIndex?: number;
  onSelectionChange?: (index: number) => void;
  allowReorder?: boolean;
  processingIndices?: number[];
  completedIndices?: number[];
  disabled?: boolean;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  allowTextMode?: boolean;
  inputType?: 'file' | 'text';
  onInputTypeChange?: (type: 'file' | 'text') => void;
  textName?: string;
  onTextNameChange?: (name: string) => void;
  textValue?: string;
  onTextValueChange?: (value: string) => void;
}

type TextSpecItem = {
  id: number;
  text: string;
  critical: boolean;
};

const CRITICAL_MARKER = '[CRITICO]';

const normalizeSpecLine = (line: string) => line
  .replace(/^\s*\d+[\).]\s*/, '')
  .replace(/\s+/g, ' ')
  .trim();

const parseTextSpecs = (value: string): TextSpecItem[] => {
  if (!value || typeof value !== 'string') {
    return [{ id: 1, text: '', critical: false }];
  }
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return [{ id: 1, text: '', critical: false }];
  }
  return lines.map((line, index) => {
    const hasCritical = line.toUpperCase().includes(CRITICAL_MARKER);
    const cleaned = normalizeSpecLine(line.replace(new RegExp(`\\${CRITICAL_MARKER}`, 'gi'), ''));
    return { id: index + 1, text: cleaned, critical: hasCritical };
  });
};

const buildTextSpecsValue = (specs: TextSpecItem[]) => {
  const lines = specs
    .map((spec, index) => {
      const text = (spec.text || '').trim();
      if (!text) return null;
      const marker = spec.critical ? `${CRITICAL_MARKER} ` : '';
      return `${index + 1}) ${marker}${text}`;
    })
    .filter(Boolean);
  return lines.join('\n');
};

const areSpecsEqual = (a: TextSpecItem[], b: TextSpecItem[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].text !== b[i].text || a[i].critical !== b[i].critical) return false;
  }
  return true;
};

const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  files,
  onFilesSelected,
  multiple = false,
  directory = false,
  accept = "application/pdf",
  helperText = "",
  variant = 'primary',
  selectionMode = 'none',
  selectedIndex = 0,
  onSelectionChange,
  allowReorder = false,
  processingIndices = [],
  completedIndices = [],
  disabled = false,
  onPrimaryAction,
  primaryActionLabel = "Process",
  allowTextMode = false,
  inputType = 'file',
  onInputTypeChange,
  textName = '',
  onTextNameChange,
  textValue = '',
  onTextValueChange
}) => {
  const { addToast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specIdRef = useRef(2);
  const [textSpecs, setTextSpecs] = useState<TextSpecItem[]>(() => parseTextSpecs(textValue));
  
  const MAX_BATCH_FILES = 100; 

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      
      const newFiles = fileList.filter(f => {
          const isSystemFile = f.name.startsWith('.') || f.name === 'Thumbs.db';
          const isPdf = f.name.toLowerCase().endsWith('.pdf');
          
          if (directory) return !isSystemFile && isPdf;
          return !isSystemFile;
      });
      
      if (directory && newFiles.length === 0 && fileList.length > 0) {
          addToast("A pasta selecionada não contém arquivos PDF válidos.", "warning");
          return;
      }

      if (directory && newFiles.length > MAX_BATCH_FILES) {
          addToast(`Muitos arquivos. Limitado a ${MAX_BATCH_FILES} por lote.`, 'error');
          return;
      }

      if (directory) {
        newFiles.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
      }

      onFilesSelected(multiple ? [...files, ...newFiles] : newFiles);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove: number, e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation(); 
    onFilesSelected(files.filter((_, index) => index !== indexToRemove));
  };

  const getFilePath = (file: File) => {
    return file.webkitRelativePath || file.name;
  };

  useEffect(() => {
    if (inputType !== 'text') return;
    const parsed = parseTextSpecs(textValue);
    if (!areSpecsEqual(parsed, textSpecs)) {
      setTextSpecs(parsed);
      specIdRef.current = parsed.length + 1;
    }
  }, [textValue, inputType]);

  useEffect(() => {
    if (inputType !== 'text') return;
    const nextValue = buildTextSpecsValue(textSpecs);
    if (nextValue !== textValue) {
      onTextValueChange?.(nextValue);
    }
  }, [textSpecs, textValue, inputType, onTextValueChange]);

  const updateSpec = (index: number, patch: Partial<TextSpecItem>) => {
    setTextSpecs((prev) => prev.map((spec, idx) => (idx === index ? { ...spec, ...patch } : spec)));
  };

  const addSpec = () => {
    setTextSpecs((prev) => [...prev, { id: specIdRef.current++, text: '', critical: false }]);
  };

  const removeSpec = (index: number) => {
    setTextSpecs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  return (
    <div className={`w-full mb-6 ${disabled ? 'opacity-70 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        {allowTextMode && onInputTypeChange && (
          <div className="flex bg-slate-100 p-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
            <button type="button" onClick={() => onInputTypeChange('file')} className={`px-3 py-1 rounded-md transition-all ${inputType === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Upload PDF</button>
            <button type="button" onClick={() => onInputTypeChange('text')} className={`px-3 py-1 rounded-md transition-all ${inputType === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{t('uploader.manualText')}</button>
          </div>
        )}
      </div>
      
      {inputType === 'file' ? (
        <div onClick={() => !disabled && fileInputRef.current?.click()} className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer group transition-colors ${directory ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple={multiple} 
            accept={!directory ? accept : undefined} 
            onChange={handleFileChange} 
            disabled={disabled} 
            {...({ webkitdirectory: directory ? "" : undefined, directory: directory ? "" : undefined } as any)} 
          />
          
          {directory ? (
             <div className="bg-indigo-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
               <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
             </div>
          ) : (
             <svg className="w-12 h-12 mb-3 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
             </svg>
          )}
          
          <p className="text-sm text-slate-700 font-semibold text-center">
            {directory ? "Selecione a PASTA onde estão os PDFs" : t('uploader.clickUpload')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {directory ? "A IA lerá todos os PDFs dentro da pasta e subpastas." : t('uploader.pdfOnly')}
          </p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
           <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('uploader.productName')}</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={textName} onChange={e => onTextNameChange?.(e.target.value)} />
           </div>
           <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">{t('uploader.characteristics')}</label>
                <button type="button" onClick={addSpec} className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-700">
                  + {t('uploader.addCharacteristic')}
                </button>
              </div>
              <div className="space-y-3">
                {textSpecs.map((spec, index) => (
                  <div key={spec.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 bg-white shadow-sm">
                    <div className="flex items-start gap-3"><div className="h-8 w-8 flex-shrink-0 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center mt-1">{index + 1}</div><div className="flex flex-col gap-2 flex-1"><input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={spec.text} placeholder={t('uploader.characteristicPlaceholder')} onChange={(e) => updateSpec(index, { text: e.target.value })} /><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" checked={spec.critical} onChange={(e) => updateSpec(index, { critical: e.target.checked })} />{t('uploader.critical')}</label></div><button type="button" onClick={() => removeSpec(index)} className="text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors mt-0.5" title={t('common.delete')}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {inputType === 'file' && files.length > 0 && (
        <div className="mt-4 animate-fade-in">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
             <span>{t('uploader.files')} ({files.length})</span>
             {directory && <span className="text-indigo-600 bg-indigo-50 px-2 rounded font-bold">Modo Pasta Ativo</span>}
          </h4>
          <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl p-2 bg-slate-50">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center truncate flex-1 mr-2">
                   <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center mr-3 shrink-0">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   </div>
                   <div className="flex flex-col truncate">
                      <span className="truncate text-sm font-medium text-slate-700" title={getFilePath(file)}>
                        {file.name}
                      </span>
                      {file.webkitRelativePath && (
                        <span className="text-[9px] text-slate-400 truncate font-mono" title={file.webkitRelativePath}>
                           {file.webkitRelativePath}
                        </span>
                      )}
                   </div>
                </div>
                <button onClick={(e) => removeFile(index, e)} className="text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUploader;


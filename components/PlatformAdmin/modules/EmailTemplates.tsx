import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor } from 'tinymce';
import { getTransactionalEmailTemplates, updateTransactionalEmailTemplateByKey } from '../../../services/api';
import { TransactionalEmailTemplate } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

const EmailTemplatesModule: React.FC = () => {
  const TINYMCE_API_KEY = 'e0biqkldsb93d7o3z7wv8mrv40pgh15zrb48cas4olfm3q5e';
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<TransactionalEmailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState<TransactionalEmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const htmlEditorRef = useRef<TinyMCEEditor | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.key === selectedKey) || null,
    [templates, selectedKey],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getTransactionalEmailTemplates();
        setTemplates(data);
        const first = data[0];
        if (first) {
          setSelectedKey(first.key);
          setDraft(first);
        }
      } catch (error: any) {
        addToast(error?.message || 'Erro ao carregar templates de email.', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [addToast]);

  useEffect(() => {
    if (selectedTemplate) setDraft(selectedTemplate);
  }, [selectedTemplate]);

  const hasChanges = !!draft && !!selectedTemplate && JSON.stringify(draft) !== JSON.stringify(selectedTemplate);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateTransactionalEmailTemplateByKey(draft.key, {
        name: draft.name,
        description: draft.description,
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
        enabled: draft.enabled,
        variables: draft.variables,
      });

      const refreshed = await getTransactionalEmailTemplates();
      setTemplates(refreshed);
      const updated = refreshed.find((t) => t.key === draft.key) || null;
      if (updated) setDraft(updated);
      addToast('Template salvo com sucesso.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Erro ao salvar template.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (!draft) return;
    const snippet = `{{${variable}}}`;
    if (htmlEditorRef.current && !htmlEditorRef.current.removed) {
      htmlEditorRef.current.focus();
      htmlEditorRef.current.insertContent(snippet);
      setDraft((prev) => (prev ? { ...prev, html: htmlEditorRef.current?.getContent() || prev.html } : prev));
    } else {
      setDraft((prev) => (prev ? { ...prev, html: `${prev.html || ''}${snippet}` } : prev));
    }
  };

  if (loading) return <div className="p-6 text-slate-500">Carregando templates de email...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Emails Transacionais</h2>
        <p className="text-slate-500">Configure os modelos de email usados pela plataforma (boas-vindas, credito, pagamentos e convites).</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {templates.map((template) => (
            <button
              key={template.key}
              onClick={() => setSelectedKey(template.key)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedKey === template.key ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-slate-800">{template.name}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${template.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {template.enabled ? 'ATIVO' : 'INATIVO'}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">{template.description}</div>
            </button>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          {!draft ? (
            <div className="text-slate-500">Selecione um template para editar.</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{draft.name}</h3>
                  <p className="text-sm text-slate-500">{draft.description}</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Ativo
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assunto</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded p-2.5 text-sm"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Corpo HTML</label>
                </div>
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <Editor
                    apiKey={TINYMCE_API_KEY}
                    cloudChannel="8"
                    value={draft.html || ''}
                    onInit={(_, editor) => {
                      htmlEditorRef.current = editor;
                    }}
                    onEditorChange={(html) => {
                      setDraft((prev) => (prev ? { ...prev, html } : prev));
                    }}
                    init={{
                      height: 360,
                      menubar: false,
                      branding: false,
                      statusbar: true,
                      plugins: [
                        'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                        'preview', 'anchor', 'searchreplace', 'visualblocks', 'code',
                        'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount',
                      ],
                      toolbar:
                        'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough forecolor backcolor | ' +
                        'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
                        'link image table charmap | removeformat code fullscreen',
                      toolbar_mode: 'sliding',
                      image_title: true,
                      automatic_uploads: true,
                      file_picker_types: 'image',
                      file_picker_callback: (callback, _value, meta) => {
                        if (meta.filetype !== 'image') return;
                        const input = document.createElement('input');
                        input.setAttribute('type', 'file');
                        input.setAttribute('accept', 'image/*');
                        input.onchange = () => {
                          const file = input.files?.[0];
                          if (!file || !htmlEditorRef.current) return;

                          const reader = new FileReader();
                          reader.onload = () => {
                            const result = reader.result;
                            if (typeof result !== 'string' || !htmlEditorRef.current) return;
                            const id = `blobid-${Date.now()}`;
                            const blobCache = htmlEditorRef.current.editorUpload.blobCache;
                            const base64 = result.split(',')[1];
                            if (!base64) return;
                            const blobInfo = blobCache.create(id, file, base64);
                            blobCache.add(blobInfo);
                            callback(blobInfo.blobUri(), { title: file.name, alt: file.name });
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      },
                      content_style:
                        'body { font-family: Inter, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #0f172a; } img { max-width: 100%; height: auto; }',
                    }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs font-bold text-slate-600 uppercase mb-2">Variaveis disponiveis</div>
                <div className="flex flex-wrap gap-2">
                  {draft.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="text-xs bg-white border border-slate-200 rounded px-2 py-1 hover:bg-slate-100"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Clique em uma variável para inserir no ponto atual do cursor no editor HTML.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Corpo Texto</label>
                <textarea
                  className="w-full border border-slate-300 rounded p-2.5 font-mono text-xs min-h-[120px]"
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => selectedTemplate && setDraft(selectedTemplate)}
                  disabled={!hasChanges || saving}
                  className="px-4 py-2 rounded border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="px-5 py-2 rounded bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Template'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailTemplatesModule;

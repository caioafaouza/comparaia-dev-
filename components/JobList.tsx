
import React, { useEffect, useState } from 'react';
import { getJobsPaginated, deleteJob, bulkDeleteJobs } from '../services/api';
import { ComparisonJob, JobStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface JobListProps {
  tenantId: string;
  onSelectJob: (jobId: string) => void;
  onNewJob: () => void;
}

const JobList: React.FC<JobListProps> = ({ tenantId, onSelectJob, onNewJob }) => {
  const { addToast } = useToast();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<ComparisonJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchJobs = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await getJobsPaginated(tenantId, currentPage, itemsPerPage, filterStatus, debouncedSearch);
      setJobs(response.jobs);
      setTotalItems(response.total);
    } catch (err) {
      addToast(t('common.loading'), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(true);
    const interval = setInterval(() => fetchJobs(false), 5000);
    return () => clearInterval(interval);
  }, [tenantId, currentPage, itemsPerPage, filterStatus, debouncedSearch]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('common.delete') + "?")) {
      await deleteJob(id);
      addToast(t('common.confirm'), "success");
      fetchJobs();
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(t('common.delete') + "?")) {
      await bulkDeleteJobs(Array.from(selectedIds));
      addToast(t('common.confirm'), "success");
      setSelectedIds(new Set());
      fetchJobs();
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === jobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(jobs.map(j => j.id)));
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('jobs.title')}</h2>
          <p className="text-slate-500">{t('jobs.subtitle')}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
              {t('common.delete')} ({selectedIds.size})
            </button>
          )}
          <button onClick={onNewJob} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 text-sm shadow-md transition-all">
            + {t('nav.newAnalysis')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative">
          <input type="text" placeholder={t('jobs.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pl-11 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
          <div className="absolute left-4 top-3 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as any); setCurrentPage(1); }}>
            <option value="ALL">{t('jobs.allStatus')}</option>
            <option value="COMPLETED">{t('jobs.completed')}</option>
            <option value="PROCESSING">{t('jobs.processing')}</option>
            <option value="FAILED">{t('jobs.failed')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[500px] relative">
        <div className="overflow-auto flex-1 custom-scrollbar max-h-[70vh]">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left w-10">
                  <input type="checkbox" checked={jobs.length > 0 && selectedIds.size === jobs.length} onChange={toggleSelectAll} className="rounded text-indigo-600" />
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.status')}</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('nav.newAnalysis')}</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('jobs.cost')}</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {jobs.length === 0 && !loading ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-500">{t('jobs.empty')}</td></tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id} onClick={() => job.status === 'COMPLETED' && onSelectJob(job.id)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(job.id)} onChange={() => { }} className="rounded text-indigo-600" />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : job.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                        {job.status === 'COMPLETED' ? t('jobs.completed') : job.status === 'FAILED' ? t('jobs.failed') : t('jobs.processing')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-600 break-all" title={job.id}>
                      {job.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{job.referenceName}</td>
                    <td className="px-6 py-4 font-mono font-bold">{job.cost} tk</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={(e) => handleDelete(job.id, e)} className="text-slate-400 hover:text-red-600 p-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500 font-medium">
            {t('jobs.total')} {totalItems} {t('jobs.reports')}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t('jobs.itemsPerPage')}</span>
            <select
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(parseInt(e.target.value, 10)); setCurrentPage(1); }}
            >
              {[10, 20, 50, 100].map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white disabled:opacity-50"
            >
              ‹
            </button>
            <span className="text-xs text-slate-500 font-bold">
              {currentPage} / {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white disabled:opacity-50"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default JobList;

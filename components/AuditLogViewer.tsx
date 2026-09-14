
import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../services/api';
import { AuditLog } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AuditProps {
  tenantId: string;
}

const AuditLogViewer: React.FC<AuditProps> = ({ tenantId }) => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs(tenantId);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [tenantId]);

  // Extract unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));

  const filteredLogs = filterAction === 'ALL'
    ? logs
    : logs.filter(log => log.action === filterAction);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            {t('audit.title')}
          </h2>
          <p className="text-slate-500">{t('audit.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ALL">{t('audit.filterAction')}</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 mr-2 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            )}
            {t('audit.refresh')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-mono text-sm">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{t('audit.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider">{t('audit.timestamp')}</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider">{t('audit.actor')}</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider">{t('audit.action')}</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider">{t('audit.resource')}</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider">{t('audit.details')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs">
                      <span title={log.userId} className="text-indigo-600 font-bold cursor-help border-b border-dotted border-indigo-300">
                        {log.userId === 'root_user' ? 'SYSTEM ROOT' : log.userId.substring(0, 8) + '...'}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${log.action.includes('LOGIN') ? 'bg-green-50 text-green-700 border-green-200' :
                          log.action.includes('CREATE') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            log.action.includes('ADMIN') ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-slate-700 text-xs">
                      {log.resource}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-slate-500 text-xs italic">
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogViewer;

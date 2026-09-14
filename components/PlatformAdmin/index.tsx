
import React, { useState } from 'react';
import AdminLayout, { AdminView } from './Layout';
import OverviewModule from './modules/Overview';
import TenantManagerModule from './modules/Tenants';
import GlobalUsersModule from './modules/Users';
import CRMModule from './modules/CRM';
import FinanceModule from './modules/Finance';
import TokensModule from './modules/Tokens';
import GlobalInvoicesModule from './modules/GlobalInvoices';
import HealthCenterModule from './modules/Health';
import LogsModule from './modules/Logs';
import GlobalSettingsModule from './modules/Settings';
import ProfileModule from './modules/Profile';
import { DatabaseConfigView, SmtpConfigView } from './modules/Infra';
import AICostsView from './modules/AICosts';
import LLMConfigModule from './modules/LLMConfig';
import WebhookModule from './modules/Webhooks';
import ApiGatewayModule from './modules/ApiGateway';
import EmailTemplatesModule from './modules/EmailTemplates';

interface PlatformAdminProps {
  onExit: () => void;
}

const PlatformAdmin: React.FC<PlatformAdminProps> = ({ onExit }) => {
  const [view, setView] = useState<AdminView>('tenants');

  const renderContent = () => {
    switch(view) {
      case 'overview': return <OverviewModule setView={setView} />;
      case 'tenants': return <TenantManagerModule />;
      case 'users': return <GlobalUsersModule />;
      case 'crm': return <CRMModule />;
      case 'finance': return <FinanceModule />;
      case 'tokens': return <TokensModule />;
      case 'global-invoices': return <GlobalInvoicesModule />;
      case 'health': return <HealthCenterModule />;
      case 'logs': return <LogsModule />;
      case 'settings': return <GlobalSettingsModule />;
      case 'profile': return <ProfileModule />;
      case 'database': return <DatabaseConfigView />;
      case 'smtp': return <SmtpConfigView />;
      case 'ai-costs': return <AICostsView />;
      case 'llm': return <LLMConfigModule />;
      case 'webhooks': return <WebhookModule />;
      case 'api-gateway': return <ApiGatewayModule />;
      case 'email-templates': return <EmailTemplatesModule />;
      default: return <div className="p-6 text-slate-500">Módulo desconhecido.</div>;
    }
  };

  return (
    <AdminLayout currentView={view} onChangeView={setView} onExit={onExit}>
      {renderContent()}
    </AdminLayout>
  );
};

export default PlatformAdmin;

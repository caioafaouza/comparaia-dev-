
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import OverviewModule from '../components/PlatformAdmin/modules/Overview';
import * as api from '../services/api';
import { PlatformMetrics } from '../types';
import React from 'react';

// Mock the api service
vi.mock('../services/api');

// Mock child components that are not relevant to this test
vi.mock('../components/PlatformAdmin/modules/Tenants', () => ({
    default: () => <div>Tenant Manager Mock</div>
}));

describe('PlatformAdmin - Overview Module', () => {

    beforeEach(() => {
        vi.resetAllMocks();
    });

    const fullMockData: PlatformMetrics = {
        mrr: 7500.50,
        totalTenants: 15,
        totalUsers: 152,
        churnRate: 4.3,
        activeAIProvider: 'Google Gemini',
        aiSuccessRate: 98.7,
        tokensConsumedToday: 1250000,
        avgLatencyMs: 450,
        totalJobsProcessed: 1200,
        tenants: []
    };

    it('overview.render.with_data: renders data correctly after successful fetch', async () => {
        (api.getGlobalPlatformData as Mock).mockResolvedValue(fullMockData);

        render(<OverviewModule setView={vi.fn()} />);

        // Check for loading state first
        expect(screen.getByText(/Carregando Control Tower.../i)).toBeInTheDocument();

        // Wait for the data to be rendered
        await waitFor(() => {
            // Check metric cards by their titles and values
            const mrrCard = screen.getByText('MRR (Receita)').closest('div.bg-white');
            expect(within(mrrCard as HTMLElement).getByRole('heading', { level: 4 })).toHaveTextContent(/7\.500,5/);

            const tenantsCard = screen.getByText('Empresas Ativas').closest('div.bg-white');
            expect(within(tenantsCard as HTMLElement).getByRole('heading', { level: 4 })).toHaveTextContent('15');

            const usersCard = screen.getByText('Total Usuários').closest('div.bg-white');
            expect(within(usersCard as HTMLElement).getByRole('heading', { level: 4 })).toHaveTextContent('152');

            expect(screen.getByText('Provedor de IA Ativo')).toBeInTheDocument();
            expect(screen.getByText('Google Gemini')).toBeInTheDocument();
        });
    });

    it('overview.render.empty: renders gracefully with empty data', async () => {
        const emptyMockData: PlatformMetrics = {
            mrr: 0,
            totalTenants: 0,
            totalUsers: 0,
            churnRate: 0,
            activeAIProvider: 'N/A',
            aiSuccessRate: 0,
            tokensConsumedToday: 0,
            avgLatencyMs: 0,
            totalJobsProcessed: 0,
            tenants: []
        };
        (api.getGlobalPlatformData as Mock).mockResolvedValue(emptyMockData);

        render(<OverviewModule setView={vi.fn()} />);

        await waitFor(() => {
            const tenantCard = screen.getByText('Empresas Ativas').closest('div.bg-white');
            expect(within(tenantCard as HTMLElement).getByRole('heading', { level: 4 })).toHaveTextContent('0');

            const mrrCard = screen.getByText('MRR (Receita)').closest('div.bg-white');
            expect(within(mrrCard as HTMLElement).getByRole('heading', { level: 4 })).toHaveTextContent(/R\$\s*0/);

            expect(screen.getByText('N/A')).toBeInTheDocument();
        });
    });

    it('overview.error.retry: displays an error message on API failure and allows retry', async () => {
        (api.getGlobalPlatformData as Mock).mockRejectedValueOnce(new Error('Network Error 500'));

        render(<OverviewModule setView={vi.fn()} />);

        // Wait for the error message
        await waitFor(() => {
            expect(screen.getByText(/Falha ao carregar os dados da plataforma./i)).toBeInTheDocument();
            expect(screen.getByText(/Network Error 500/i)).toBeInTheDocument();
        });

        // Check for the retry button
        const retryButton = screen.getByRole('button', { name: /Tentar Novamente/i });
        expect(retryButton).toBeInTheDocument();
    });
});


import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import TenantManagerModule from '../components/PlatformAdmin/modules/Tenants';
import * as api from '../services/api';
import React from 'react';
import { ToastProvider } from '../contexts/ToastContext';

// Mock the entire api service
vi.mock('../services/api');

// A wrapper component that includes the ToastProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe('PlatformAdmin - Tenant Manager Module', () => {

    const mockTenants = [
        { id: 't1', name: 'InnovateTech', slug: 'innovate-tech', status: 'ACTIVE', plan: 'ENTERPRISE', mrr: 500, sector: 'Technology', phone: '11999999999', cnpj: '12345678000199', createdAt: '2023-01-01', userCount: 5, walletBalance: 100, totalJobs: 10, tokensConsumedToday: 500, lastActivity: '2023-01-02' },
        { id: 't2', name: 'HealthWell', slug: 'health-well', status: 'SUSPENDED', plan: 'PRO', mrr: 150, sector: 'Healthcare', phone: '21988888888', cnpj: '87654321000155', createdAt: '2023-02-01', userCount: 2, walletBalance: 0, totalJobs: 0, tokensConsumedToday: 0, lastActivity: '2023-02-02' },
    ];

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('tenants.list.pass: fetches and displays a list of tenants', async () => {
        (api.adminListTenants as Mock).mockResolvedValue(mockTenants);

        render(
            <TestWrapper>
                <TenantManagerModule />
            </TestWrapper>
        );

        // Wait for the tenants to be rendered
        await waitFor(() => {
            expect(screen.getByText('InnovateTech')).toBeInTheDocument();
            expect(screen.getByText(/health-well/i)).toBeInTheDocument();
            expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
            expect(screen.getByText('ENTERPRISE')).toBeInTheDocument();
        });
    });
});

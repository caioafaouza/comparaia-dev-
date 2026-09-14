
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GlobalUsersModule from '../components/PlatformAdmin/modules/Users';
import GlobalSettingsModule from '../components/PlatformAdmin/modules/Settings';
import { DatabaseConfigView } from '../components/PlatformAdmin/modules/Infra';
import React from 'react';

// Mock Toast
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));

describe('Admin Miscellaneous Modules', () => {
    it('renders global users list', async () => {
        render(<GlobalUsersModule />);
        await waitFor(() => {
            expect(screen.getByText('User One')).toBeInTheDocument();
            expect(screen.getByText('u1@test.com')).toBeInTheDocument();
        });
    });

    it('renders global settings', async () => {
        render(<GlobalSettingsModule />);
        await waitFor(() => {
            // Check for the main title
            expect(screen.getByText(/Configurações da Plataforma/i)).toBeInTheDocument();
            // Check for a subtitle
            expect(screen.getByText(/Parâmetros Gerais/i)).toBeInTheDocument();
        });
    });

    it('renders database config', async () => {
        render(<DatabaseConfigView />);
        await waitFor(() => {
            // Check for specific DB fields
            expect(screen.getByText(/Host/i)).toBeInTheDocument();
            expect(screen.getAllByDisplayValue('localhost')[0]).toBeInTheDocument();
        });
    });
});

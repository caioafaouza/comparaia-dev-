
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlatformAdmin from '../components/PlatformAdmin/index';
import React from 'react';

// Mock child modules to simplify testing the navigation/layout
vi.mock('../components/PlatformAdmin/modules/Overview', () => ({
    default: () => <div data-testid="module-overview">Overview Module</div>
}));
vi.mock('../components/PlatformAdmin/modules/Tenants', () => ({
    default: () => <div data-testid="module-tenants">Tenants Module</div>
}));
vi.mock('../components/PlatformAdmin/modules/Users', () => ({
    default: () => <div data-testid="module-users">Users Module</div>
}));

describe('PlatformAdmin Integration', () => {
    it('renders default view (Tenants) on mount', () => {
        render(<PlatformAdmin onExit={vi.fn()} />);
        expect(screen.getByTestId('module-tenants')).toBeInTheDocument();
    });

    it('navigates to Overview when clicked', () => {
        render(<PlatformAdmin onExit={vi.fn()} />);

        // Target buttons by their rendered text which includes icon + text
        // "Dashboard" is the text for Overview
        const dashboardBtn = screen.getByRole('button', { name: /Dashboard/i });
        fireEvent.click(dashboardBtn);

        expect(screen.getByTestId('module-overview')).toBeInTheDocument();
    });

    it('navigates to Users when clicked', () => {
        render(<PlatformAdmin onExit={vi.fn()} />);

        // "Usuários" is the text for Users module
        const usersBtn = screen.getByRole('button', { name: /Usuários/i });
        fireEvent.click(usersBtn);

        expect(screen.getByTestId('module-users')).toBeInTheDocument();
    });
});

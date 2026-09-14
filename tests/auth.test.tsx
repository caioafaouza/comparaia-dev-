
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginScreen } from '../components/AuthScreens';
import React from 'react';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('LoginScreen (Master Admin)', () => {
    
    it('[auth.master.login.render] renders login form correctly', () => {
        render(<LoginScreen onSuccess={vi.fn()} onSwitch={vi.fn()} />);
        expect(screen.getByPlaceholderText(/Endereço de e-mail/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Senha/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
    });

    it('[auth.master.login.success] handles successful master admin login', async () => {
        // ARRANGE
        // Override the generic handler with a specific one for this test
        server.use(
            http.post('/api/auth/login', async ({ request }) => {
                const body = await request.json() as any;
                return HttpResponse.json({
                    token: 'real-admin-token',
                    user: { id: 'admin-user-id', name: 'Admin User', email: body.email, role: 'PLATFORM_ADMIN' },
                    tenant: { id: 'master', name: 'Master', slug: 'MASTER' }
                });
            })
        );
        
        const onSuccessMock = vi.fn();
        render(<LoginScreen onSuccess={onSuccessMock} onSwitch={vi.fn()} />);

        // ACT
        fireEvent.change(screen.getByPlaceholderText(/Endereço de e-mail/i), { target: { value: 'admin@master.com' } });
        fireEvent.change(screen.getByPlaceholderText(/Senha/i), { target: { value: 'admin123' } });
        fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

        // ASSERT
        await waitFor(() => {
            expect(onSuccessMock).toHaveBeenCalledOnce();
        });

        const session = onSuccessMock.mock.calls[0][0];
        expect(session.user.email).toBe('admin@master.com');
        expect(session.user.role).toBe('PLATFORM_ADMIN');
        expect(session.tenant.slug).toBe('MASTER');
    });

    it('[auth.master.login.fail.invalid] displays error on invalid credentials (401)', async () => {
        // ARRANGE
        server.use(
            http.post('/api/auth/login', () => {
                return HttpResponse.json({ error: { message: 'Credenciais inválidas' } }, { status: 401 });
            })
        );
        
        const onSuccessMock = vi.fn();
        render(<LoginScreen onSuccess={onSuccessMock} onSwitch={vi.fn()} />);

        // ACT
        fireEvent.change(screen.getByPlaceholderText(/Endereço de e-mail/i), { target: { value: 'wrong@user.com' } });
        fireEvent.change(screen.getByPlaceholderText(/Senha/i), { target: { value: 'wrongpass' } });
        fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

        // ASSERT
        // The error message comes from the ApiError thrown by our refactored apiFetch
        await screen.findByText('Sessão expirada. Por favor, faça login novamente.');
        expect(onSuccessMock).not.toHaveBeenCalled();
    });

    it('[auth.master.login.fail.offline] displays error on 500 server error', async () => {
        // ARRANGE
        server.use(
            http.post('/api/auth/login', () => {
                return HttpResponse.json({ error: { message: 'Ocorreu um erro inesperado no servidor.' } }, { status: 500 });
            })
        );

        const onSuccessMock = vi.fn();
        render(<LoginScreen onSuccess={onSuccessMock} onSwitch={vi.fn()} />);

        // ACT
        fireEvent.change(screen.getByPlaceholderText(/Endereço de e-mail/i), { target: { value: 'any@user.com' } });
        fireEvent.change(screen.getByPlaceholderText(/Senha/i), { target: { value: 'anypass' } });
        fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));
        
        // ASSERT
        await screen.findByText('Ocorreu um erro inesperado no servidor.');
        expect(onSuccessMock).not.toHaveBeenCalled();
    });

    it('[auth.master.login.fail.ratelimit] displays error on 429 rate limit', async () => {
        // ARRANGE
        server.use(
            http.post('/api/auth/login', () => {
                return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '90' } });
            })
        );

        const onSuccessMock = vi.fn();
        render(<LoginScreen onSuccess={onSuccessMock} onSwitch={vi.fn()} />);

        // ACT
        fireEvent.change(screen.getByPlaceholderText(/Endereço de e-mail/i), { target: { value: 'frequent@user.com' } });
        fireEvent.change(screen.getByPlaceholderText(/Senha/i), { target: { value: 'anypass' } });
        fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

        // ASSERT
        await screen.findByText('Muitas requisições. Tente novamente em 90s.');
        expect(onSuccessMock).not.toHaveBeenCalled();
    });
});

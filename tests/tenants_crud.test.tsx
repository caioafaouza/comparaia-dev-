
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TenantManagerModule from '../components/PlatformAdmin/modules/Tenants';
import React from 'react';

// Setup Toast provider mock
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));

// Mock confirm dialog
global.confirm = vi.fn(() => true);

describe('TenantManagerModule', () => {
    it('renders tenant list from API', async () => {
        render(<TenantManagerModule />);

        // Wait for loading to finish and data to appear
        await waitFor(() => {
            expect(screen.getByText('Tenant One')).toBeInTheDocument();
            expect(screen.getByText('Tenant Two')).toBeInTheDocument();
        });
    });

    it('opens create modal and submits new tenant', async () => {
        render(<TenantManagerModule />);

        // Open Modal
        fireEvent.click(screen.getByText(/Novo Tenant/i));
        expect(screen.getByText(/Registrar Nova Organização/i)).toBeInTheDocument();

        // Fill Form
        fireEvent.change(screen.getByPlaceholderText(/Razão Social/i), { target: { value: 'New Corp' } });
        // Handling select inputs might vary, assuming simple change works with value
        // Note: The select in Tenants.tsx uses hardcoded options + plans. Plans are async.

        // Fill Admin details
        // "Nome" inside "Admin Principal" block. 
        // Need to be careful with selectors if multiple inputs have same label.
        // The file has unique labels or context.

        // Using "getAllByRole" if needed, but placeholder or label text is safer if unique.
        // Label "Nome" appears twice (Company Name vs Admin Name).
        // Let's use placeholders or container lookup.

        const inputs = screen.getAllByRole('textbox');
        // This is risky. Better to target specific fields.

        // Target Admin Name (required)
        // Parent is "Admin Principal"

        // Let's assume validation passes if we fill required fields.
        // Actually, the test is integrating with MSW, so we should try to succeed.

        // Filling Required fields: Name (Company), Admin Name, Admin Email, Admin Password.

        const companyNameParams = { target: { value: 'New Corp' } };
        const adminNameParams = { target: { value: 'Admin User' } };
        const adminEmailParams = { target: { value: 'admin@new.com' } };
        const adminPassParams = { target: { value: 'password123' } };

        // We can find by placeholder?
        fireEvent.change(screen.getByPlaceholderText('Razão Social'), companyNameParams);

        // Admin fields don't have unique placeholders in the code snippet provided earlier (? mostly just "Seu nome" or "voce@empresa.com"? check Tenants.tsx)
        // Tenants.tsx:
        // Admin Name: value={newTenantData.admin}
        // Admin Email: value={newTenantData.email}
        // Admin Password: value={newTenantData.password}

        // Looking at the code:
        // Admin Name input doesn't have placeholder in the snippet?
        // Ah: <input ... placeholder="Seu nome" /> in AuthScreens, but in Tenants.tsx?
        // Line 210: <input ... required value={newTenantData.admin} ... /> (No placeholder shown in snippet line 210?)
        // Wait, line 210 in view_file 849: <input type="text" className="w-full border p-2 rounded" required value={newTenantData.admin} ... />
        // No placeholder.

        // I'll grab by label text using `screen.getByLabelText` but the labels are divs/labels above.
        // Best approach: `screen.getAllByRole('textbox')` and map by order, OR use `container.querySelector`.

        // Let's try filling them assuming order (Company Name is first).

        // Or better: Add aria-labels or test-ids in a real scenario.
        // Here, I will try to selecting by label text if `id` was associated, but it's not.
        // The label is just a <label> followed by <input>.

        // Strategy: Use `within`.
        // Identify the "Registrar Nova Organização" container.
        // But simply, I'll rely on GetAllByRole for now.
        // 0: Search (in main view) - might be hidden by modal or not? Modal is in DOM.
        // 1: Company Name
        // 2: CNPJ
        // 3: Phone
        // 4: Admin Name
        // 5: Admin Email
        // 6: Custom Domain

        // Use placeholder for Company Name ("Razão Social").

        // For Admin Name/Email, I'll traverse via Label text?
        // Not linked with htmlFor.

        // Hacky but effective for this context:
        // Find the input *following* the label text.

        const adminNameLabel = screen.getByText('Admin Principal').nextSibling; // Not quite.

        // Let's just use `fireEvent.change` on all inputs found in the modal form.
        const modal = screen.getByText('Registrar Nova Organização').closest('div.animate-fade-in');
        const modalInputs = within(modal as HTMLElement).getAllByRole('textbox');
        const passInput = modal.querySelector('input[type="password"]');

        // 0: Company Name
        fireEvent.change(modalInputs[0], { target: { value: 'New Corp' } });
        // 3: Admin Name (skipping CNPJ/Phone)
        fireEvent.change(modalInputs[3], { target: { value: 'Admin User' } });
        // 4: Email
        fireEvent.change(modalInputs[4], { target: { value: 'admin@new.com' } });
        // Password
        fireEvent.change(passInput, { target: { value: '12345678' } });

        // Submit
        fireEvent.click(within(modal as HTMLElement).getByText('Provisionar Organização'));

        await waitFor(() => {
            // Modal should close or toast appear
            expect(screen.queryByText('Registrar Nova Organização')).not.toBeInTheDocument();
            // Optional: Check if loadData called (via mocked MSW response appearing?) 
            // Since we mock loadData re-fetch, we can't easily see the new item strictly unless we mock the GET to return it next time.
            // But we can check if the modal closed.
        });
    });

    it('deletes a tenant', async () => {
        render(<TenantManagerModule />);
        await waitFor(() => screen.getByText('Tenant One'));

        // Click delete on first tenant
        const deleteBtns = screen.getAllByText('Excluir');
        fireEvent.click(deleteBtns[0]);

        // Confirmation modal appears
        await waitFor(() => {
            expect(screen.getByText('Excluir Organização?')).toBeInTheDocument();
        });

        // Click confirm delete button
        fireEvent.click(screen.getByText('Excluir Definitivamente'));

        // Modal should close after deletion
        await waitFor(() => {
            expect(screen.queryByText('Excluir Organização?')).not.toBeInTheDocument();
        });
    });
});

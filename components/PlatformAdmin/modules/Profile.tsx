
import React from 'react';

const ProfileModule: React.FC = () => {
    return (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
            <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">SA</div>
            <h2 className="text-xl font-bold text-slate-900">Super Admin</h2>
            <p className="text-slate-500">root@platform.com</p>
            <div className="mt-6 flex justify-center gap-4">
                <span className="bg-slate-100 px-3 py-1 rounded text-xs font-bold text-slate-600">MFA Ativo</span>
                <span className="bg-slate-100 px-3 py-1 rounded text-xs font-bold text-slate-600">Sessão Segura</span>
            </div>
        </div>
    );
};

export default ProfileModule;

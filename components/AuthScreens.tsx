
import React, { useState } from 'react';
import { login, register, requestPasswordReset, verifyPasswordResetCode, confirmPasswordReset } from '../services/api';
import { AuthSession } from '../types';
import Logo from './Logo';
import { useToast } from '../contexts/ToastContext';

interface AuthProps {
  onSuccess: (session: AuthSession) => void;
}

export const LoginScreen: React.FC<AuthProps & { onSwitch: () => void; onForgotPassword: () => void }> = ({ onSuccess, onSwitch, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await login(
        email,
        password
      );
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <div className="text-center flex flex-col items-center">
          <Logo className="w-20 h-20" />
          <p className="mt-2 text-sm text-slate-600">
            Acesse sua conta corporativa
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Endereço de e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-red-500 text-sm text-center">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-800 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Esqueceu a senha?
            </button>
          </div>

          {/* Demo buttons removed for production/validation */}
        </form>

        <div className="text-center">
          <button onClick={onSwitch} className="text-blue-800 hover:text-blue-700 text-sm font-medium">
            Não tem uma conta? Crie uma organização na plataforma
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Rigor de engenharia e precisão técnica para garantir segurança e previsibilidade em cada decisão.
          </p>
        </div>
      </div>
    </div>
  );
};

export const ForgotPasswordScreen: React.FC<{ onBackToLogin: () => void }> = ({ onBackToLogin }) => {
  const { addToast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState(params.get('code') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>(() => {
    if (params.get('email') && params.get('code')) return 'verify';
    return 'request';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await requestPasswordReset(email);
      setNotice('Enviamos um código de recuperação para seu e-mail (quando cadastrado).');
      setStep('verify');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível solicitar recuperação de senha.');
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await verifyPasswordResetCode(email, code);
      setNotice('Código validado. Agora defina sua nova senha.');
      setStep('reset');
    } catch (err: any) {
      setError(err?.message || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    if (newPassword !== confirmNewPassword) {
      setLoading(false);
      setError('As senhas informadas não coincidem.');
      return;
    }
    try {
      await confirmPasswordReset(email, code, newPassword, confirmNewPassword);
      addToast('Senha redefinida com sucesso. Faça login com a nova senha.', 'success');
      onBackToLogin();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <div className="text-center flex flex-col items-center">
          <Logo className="w-16 h-16" />
          <h2 className="mt-4 text-2xl font-extrabold text-slate-900">Recuperar senha</h2>
          <p className="mt-2 text-sm text-slate-600">
            {step === 'request' && 'Informe seu e-mail para receber o código de recuperação.'}
            {step === 'verify' && 'Digite o código recebido por e-mail (válido por 30 minutos).'}
            {step === 'reset' && 'Defina a nova senha e confirme para concluir.'}
          </p>
        </div>

        {notice && <div className="text-green-700 text-sm text-center bg-green-50 py-2 rounded-lg">{notice}</div>}
        {error && <div className="text-red-600 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</div>}

        {step === 'request' && (
          <form className="space-y-4" onSubmit={submitRequest}>
            <input
              type="email"
              required
              className="block w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
              placeholder="Endereço de e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 font-semibold disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form className="space-y-4" onSubmit={submitVerify}>
            <input
              type="email"
              required
              className="block w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
              placeholder="Endereço de e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="text"
              required
              maxLength={6}
              className="block w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 tracking-[0.3em] text-center font-semibold"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 font-semibold disabled:opacity-50"
            >
              {loading ? 'Validando...' : 'Validar código'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form className="space-y-4" onSubmit={submitReset}>
            <input
              type="password"
              required
              minLength={8}
              className="block w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
              placeholder="Nova senha (mínimo 8 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              required
              minLength={8}
              className="block w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900"
              placeholder="Repita a nova senha"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 font-semibold disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}

        <div className="text-center">
          <button onClick={onBackToLogin} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">
            Voltar para login
          </button>
        </div>
      </div>
    </div>
  );
};

export const RegisterScreen: React.FC<AuthProps & { onSwitch: () => void }> = ({ onSuccess, onSwitch }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    cnpj: '',
    phone: '',
    sector: 'Indústria',
    purchaseVolume: 'R$ 100k - R$ 1M'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (formData.password !== formData.confirmPassword) {
      setLoading(false);
      setError('As senhas informadas não coincidem.');
      return;
    }
    if (!strongPasswordRegex.test(formData.password)) {
      setLoading(false);
      setError('Senha fraca. Use mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.');
      return;
    }
    try {
      const session = await register({
        company: formData.company,
        name: formData.name,
        email: formData.email,
        pass: formData.password,
        cnpj: formData.cnpj,
        phone: formData.phone,
        sector: formData.sector,
        purchaseVolume: formData.purchaseVolume
      });
      addToast('Cadastro realizado com sucesso! Bem-vindo(a) à plataforma.', 'success');
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8 bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-200">
        <div className="text-center flex flex-col items-center">
          <Logo className="w-12 h-12" />
          <h2 className="text-3xl font-extrabold text-slate-900 mt-4 tracking-tight">Criar Nova Organização</h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md">
            Comece a automatizar suas homologações técnicas hoje mesmo.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Empresa</label>
              <input
                name="company"
                type="text"
                required
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                value={formData.company}
                onChange={handleChange}
                placeholder="Razão Social ou Nome Fantasia"
                data-testid="register-tenant-name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF/CNPJ</label>
              <input
                name="cnpj"
                type="text"
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                value={formData.cnpj}
                onChange={handleChange}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                data-testid="register-tenant-cnpj"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
              <input
                name="phone"
                type="text"
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(11) 99999-9999"
                data-testid="register-tenant-phone"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Setor Industrial</label>
              <select
                name="sector"
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white cursor-pointer transition-all"
                value={formData.sector}
                onChange={handleChange}
                data-testid="register-tenant-sector"
              >
                <option value="Construção Civil">Construção Civil</option>
                <option value="Indústria">Indústria</option>
                <option value="Hardware TI">Hardware TI</option>
                <option value="Hospitalar">Hospitalar</option>
                <option value="Serviços">Serviços</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Volume Mensal (Est.)</label>
              <select
                name="purchaseVolume"
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white cursor-pointer transition-all"
                value={formData.purchaseVolume}
                onChange={handleChange}
                data-testid="register-tenant-volume"
              >
                <option value="Até R$ 100k">Até R$ 100k</option>
                <option value="R$ 100k - R$ 1M">R$ 100k - R$ 1M</option>
                <option value="R$ 1M - R$ 10M">R$ 1M - R$ 10M</option>
                <option value="Acima de R$ 10M">Acima de R$ 10M</option>
              </select>
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Administrador do Sistema</h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
              <input
                name="name"
                type="text"
                required
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={formData.name}
                onChange={handleChange}
                placeholder="Seu nome"
                data-testid="register-admin-name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Corporativo</label>
              <input
                name="email"
                type="email"
                required
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={formData.email}
                onChange={handleChange}
                placeholder="voce@empresa.com"
                data-testid="register-admin-email"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha de Acesso</label>
              <input
                name="password"
                type="password"
                required
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={formData.password}
                onChange={handleChange}
                placeholder="Mín. 8 + A-Z + a-z + número + especial"
                data-testid="register-admin-password"
              />
              <p className="mt-1 text-xs text-slate-500">
                A senha deve conter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Senha</label>
              <input
                name="confirmPassword"
                type="password"
                required
                className="block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Digite a senha novamente"
                data-testid="register-admin-password-confirm"
              />
            </div>
          </div>

          {error && <div className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 border border-transparent text-lg font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all shadow-lg hover:shadow-indigo-500/20 transform hover:-translate-y-0.5"
              data-testid="register-submit-button"
            >
              {loading ? 'Processando Setup...' : 'Criar Organização & Começar'}
            </button>
          </div>
        </form>
        <div className="text-center pt-4">
          <button onClick={onSwitch} className="text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors">
            Já possui conta? <span className="text-indigo-600 font-bold">Faça login</span>
          </button>
        </div>
      </div>
    </div>
  );
};



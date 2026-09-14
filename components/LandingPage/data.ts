import React from 'react';

// --- HERO SECTION ---
export const HERO_CONTENT = {
  badge: 'Plataforma de Equalização Técnica com IA',
  title: 'Transforme cotações complexas em',
  titleHighlight: 'decisão técnica segura.',
  description:
    'O <strong>COMPARA IA</strong> compara PDF contra PDF, identifica desvios de especificação, organiza evidências e entrega relatório técnico pronto para validação da sua equipe.',
  ctaPrimary: 'Criar Conta e Testar',
  ctaSecondary: 'Ver Como Funciona',
  riskReversal: ['Plano inicial disponível', 'Sem cartão para começar', 'Ambiente com isolamento por tenant']
};

// --- SOCIAL PROOF ---
export const SOCIAL_PROOF_CONTENT = {
  label: 'Desenvolvido para operações de compras técnicas e licitações',
  metrics: [
    { value: 'PDF ↔ PDF', label: 'Comparação técnica automática', color: 'text-slate-900' },
    { value: 'Matriz', label: 'Consolidação de aderência por item', color: 'text-emerald-600' },
    { value: 'Relatório', label: 'Exportação técnica em PDF', color: 'text-indigo-600' },
    { value: 'RFQ', label: 'Geração assistida de draft', color: 'text-slate-900' }
  ]
};

// --- PRICING ---
export const PRICING_CONTENT = {
  title: 'Planos para',
  titleHighlight: 'operações de qualquer porte',
  description:
    'Comece com um plano de entrada e escale com recursos avançados conforme sua operação evolui.',
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      price: 'Entrada',
      period: 'para começar',
      description: 'Ideal para validar o fluxo técnico com seus próprios arquivos.',
      features: [
        { text: 'Comparação técnica PDF vs PDF', icon: 'check' },
        { text: 'Matriz técnica detalhada', icon: 'check' },
        { text: 'Exportação de relatório em PDF', icon: 'check' }
      ],
      cta: 'Começar Agora',
      highlight: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 'Equipe',
      period: 'em escala',
      description: 'Para times que processam volume recorrente e exigem velocidade.',
      features: [
        { text: 'Maior capacidade de processamento', icon: 'check' },
        { text: 'Busca de mercado integrada', icon: 'check' },
        { text: 'Painel com métricas e custos', icon: 'check' },
        { text: 'Gestão de usuários e permissões', icon: 'check' }
      ],
      cta: 'Ativar Plano Pro',
      highlight: true,
      tag: 'Mais escolhido'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Corporativo',
      period: 'sob demanda',
      description: 'Para empresas com compliance rígido e requisitos avançados.',
      features: [
        { text: 'Administração centralizada (Control Tower)', icon: 'check' },
        { text: 'Configuração de SMTP e templates transacionais', icon: 'check' },
        { text: 'Recursos avançados de segurança e auditoria', icon: 'check' },
        { text: 'Suporte para operações multi-tenant', icon: 'check' }
      ],
      cta: 'Falar com Especialista',
      highlight: false
    }
  ]
};

// --- FAQ ---
export const FAQ_ITEMS = [
  {
    q: 'O COMPARA IA compara documentos técnicos em PDF?',
    a: 'Sim. A plataforma processa os documentos de referência e candidatos, estruturando os critérios em uma matriz técnica para facilitar a análise comparativa.'
  },
  {
    q: 'É possível exportar o resultado em relatório?',
    a: 'Sim. O sistema gera relatório técnico em PDF com os principais pontos de aderência e divergência identificados durante a análise.'
  },
  {
    q: 'A plataforma serve para equipes de licitação e compras corporativas?',
    a: 'Sim. O fluxo foi desenhado para cenários com especificações detalhadas e múltiplos fornecedores, comuns em licitações e compras técnicas.'
  },
  {
    q: 'Existe gestão de usuários e times?',
    a: 'Sim. Há módulos de usuários, equipe e controle administrativo para acompanhar acesso, atividade e operação por tenant.'
  },
  {
    q: 'Posso configurar os e-mails transacionais da operação?',
    a: 'Sim. No painel administrativo é possível configurar SMTP e editar templates de e-mails transacionais usados pela plataforma.'
  },
  {
    q: 'A plataforma oferece recuperação de senha e segurança de acesso?',
    a: 'Sim. O sistema possui fluxo de recuperação de senha por código temporário e validações de credenciais para reforçar segurança de acesso.'
  }
];

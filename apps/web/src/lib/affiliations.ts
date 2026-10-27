export const legalVersion = '2026-10-26';
export type AffiliationData = {
  name: string;
  city: string;
  state: string;
  age: number;
  degrees: string[];
  legapp: string;
  blue: string;
  email: string;
  current: string;
  plans: string;
  contribution: string;
  legalVersion: string;
  acceptedAt: string;
};
export type Delivery = {
  state: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown';
  attempts: number;
  error?: string;
  sentAt?: string;
  retryAt?: string;
};
export type Affiliation = {
  id: string;
  accountId: string;
  discord: string;
  data: AffiliationData;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'revoked';
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
  deliveries?: { role?: Delivery; dm?: Delivery };
};
export type ApplicantSession = {
  user: { id: string; discord: string; member: boolean };
  csrf: string;
  request: Affiliation | null;
  legalVersion: string;
  currents: string[];
};
export const affiliationStatuses = {
  pending: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Recusada',
  withdrawn: 'Retirada',
  revoked: 'Encerrada',
};
export const deliveryErrors: Record<string, string> = {
  BOT_NOT_CONFIGURED: 'Bot ainda não configurado.',
  DM_BLOCKED:
    'O Discord bloqueou a mensagem direta. A pessoa pode precisar permitir mensagens do servidor.',
  BOT_TOKEN_INVALID: 'Confira o token do bot no backend.',
  BOT_PERMISSION_DENIED: 'Confira Gerenciar cargos e a posição do bot acima do cargo Filiado.',
  DISCORD_MEMBER_OR_RESOURCE_MISSING:
    'Confira se a pessoa e o bot estão no servidor e se o cargo existe.',
  DISCORD_RATE_LIMITED: 'O Discord limitou os envios. Aguarde o prazo antes de tentar novamente.',
  DELIVERY_UNCONFIRMED:
    'Não foi possível confirmar o envio. Uma nova tentativa pode duplicar a mensagem.',
  DISCORD_REJECTED: 'O Discord não aceitou a operação.',
};

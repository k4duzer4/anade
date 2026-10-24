export type Group = {
  id: string;
  name: string;
  type: string;
  state: string;
  description: string;
  memberIds: string[];
  leaderId: string;
  canAccess: boolean;
};
export type GroupNote = {
  id: string;
  groupId: string;
  title: string;
  body: string;
  type: string;
  status: string;
  dueDate: string;
  assignedId: string;
  mentionIds: string[];
  authorId: string;
  createdAt: string;
};
export type Wallet = {
  id: string;
  name: string;
  type: string;
  memberIds: string[];
  balance: number;
  reserved: number;
  available: number;
  reservations: (Entry & { remaining: number })[];
};
export type Entry = {
  id: string;
  walletId: string;
  title: string;
  body: string;
  type: string;
  amountCents: number;
  recipient: string;
  reservationId: string;
  date: string;
  authorId: string;
  createdAt: string;
};
export type LegalCase = {
  id: string;
  title: string;
  body: string;
  type: string;
  status: string;
  reference: string;
  provider: string;
  start: string;
  end: string;
  dueDate: string;
  paymentStatus: string;
  amountCents: number;
  assignedId: string;
  memberIds: string[];
  authorId: string;
};
export type GameEvent = {
  id: string;
  title: string;
  body?: string;
  date: string;
  type: string;
  status?: string;
  estimated?: boolean;
};
export type GameCalendar = {
  serverTime: string;
  today: string;
  nextTick: string;
  day: number | null;
  gameDate: string;
  milestones: GameEvent[];
  events: GameEvent[];
  source: string;
  wiki: string;
  config: { startDate?: string; duration?: number; updatedAt?: string };
};
export type Notification = {
  key: string;
  title: string;
  href: string;
  type: string;
  date?: string;
  createdAt: string;
  read: boolean;
};
export type Page<T> = { records: T[]; page: number; hasMore: boolean; total: number };
export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const groupNames: Record<string, string> = {
  camara: 'Câmara',
  senado: 'Senado',
  direcao: 'Direção',
  estadual: 'Diretório estadual',
  juridico: 'Jurídico',
  comunicacao: 'Comunicação',
  tesouraria: 'Tesouraria',
  outro: 'Grupo de trabalho',
};
export const noteNames: Record<string, string> = {
  prioridade: 'Prioridade legislativa',
  pauta: 'Pauta',
  negociacao: 'Negociação',
  orientacao: 'Orientação de voto',
  tarefa: 'Tarefa',
  aviso: 'Aviso',
};
export const walletNames: Record<string, string> = {
  partidario: 'Caixa partidário',
  fundo: 'Fundo eleitoral',
  campanha: 'Campanha',
};
export const entryNames: Record<string, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  reserva: 'Reserva',
  liberacao: 'Liberação de reserva',
};
export const legalNames: Record<string, string> = {
  contrato: 'Contrato',
  servico: 'Serviço',
  processo: 'Processo',
  intimacao: 'Intimação',
};
export const statusNames: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pendente: 'Pendente',
  pago: 'Pago',
  nao_aplicavel: 'Não se aplica',
};
export const eventNames: Record<string, string> = {
  campanha: 'Campanha',
  eleicao: 'Eleição',
  posse: 'Posse',
  efeito: 'Efeito pendente',
  prazo: 'Prazo',
  outro: 'Outro',
};
export const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
export const cents = (value: FormDataEntryValue | undefined) => {
  const s = String(value || '0').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Use um valor com até duas casas decimais.');
  return Math.round(Number(s) * 100);
};

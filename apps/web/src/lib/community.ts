export type CommunityItem = {
  id: string;
  ownerId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  supports: number;
  comments: number;
  reads: number;
  supported: boolean;
  read: boolean;
  pollId?: string;
  pinned?: boolean;
  dueDate?: string;
  office?: string;
  state?: string;
  materials?: string[];
  commitments?: string;
  type?: string;
  start?: string;
  end?: string;
};
export type CommunityList = {
  records: CommunityItem[];
  page: number;
  hasMore: boolean;
  open?: boolean;
  mine?: CommunityItem | null;
};
export async function loadCommunity<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Não foi possível carregar esta área. Tente novamente.');
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Não foi possível concluir a consulta.');
  return value;
}
export const shortDay = (day: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );

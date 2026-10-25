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
export { loadCommunity } from './portal-read';
export const shortDay = (day: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );

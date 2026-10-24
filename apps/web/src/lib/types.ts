export type Member = {
  id: string;
  discord: string;
  name: string;
  blue: string;
  legapp?: string;
  shareLegapp: boolean;
  age: number;
  state: string;
  ideology: string;
  office: string;
  profession: string;
  city: string;
  season: string;
  oab: string;
  bio: string;
  degrees: string[];
  joinedAt: string;
  avatarUrl?: string;
  bannerUrl?: string;
};
export type Meeting = {
  id: string;
  groupId?: string;
  title: string;
  date: string;
  location: string;
  agenda: string[];
  minutes: string;
  meetUrl: string;
  docsUrl: string;
  attendance: string[];
};
export type Poll = {
  id: string;
  canVote?: boolean;
  governance?: {
    groupId: string;
    groupName: string;
    electorIds: string[];
    quorumPercent: number;
    rule: string;
    opensAt: string;
  };
  outcome?: {
    quorum: number;
    quorumReached: boolean;
    electorate: number;
    threshold: number;
    winner: number | null;
    reason: string;
  };
  title: string;
  description: string;
  options: string[];
  deadline: string;
  secret: boolean;
  closed: boolean;
  total: number;
  hasVoted: boolean;
  myVote: number | null;
  counts?: number[];
  abstentionIndex: number;
  abstentions?: number;
  validVotes?: number;
  ballots?: { id: string; option: number }[];
};
export type PortalState = {
  serverTime: string;
  user: { id: string; discord: string; admin: boolean };
  csrf: string;
  members: Member[];
  meetings: Meeting[];
  directors: Director[];
  polls: Poll[];
};
export type Director = {
  id: string;
  memberId: string;
  title: string;
  responsibility: string;
  position: number;
};
export type Config = {
  partyName: string;
  acronym: string;
  number: number;
  demo: boolean;
  configured: boolean;
  ideologies: string[];
  degrees: string[];
  states: string[];
  electoralOffices: string[];
};
export type Checkin = {
  id: string;
  memberId: string;
  day: string;
  createdAt: string;
  name: string;
  discord: string;
  blue: string;
  office: string;
  proofs: { actions: string; blue: string };
};
export type CheckinList = {
  records: Checkin[];
  hasMore: boolean;
  today: string;
  todayRecord?: Checkin | null;
  storageReady: boolean;
  members?: { id: string; name: string; discord: string }[];
};
export type CheckinRanking = {
  records: {
    memberId: string;
    name: string;
    discord: string;
    avatarUrl: string;
    points: number;
    position: number;
    lastDay: string;
  }[];
  summary: { points: number; participants: number };
  period: '7' | '30' | 'all';
  since: string | null;
  until: string;
  page: number;
  hasMore: boolean;
};
export const formatDate = (value: string, full = false) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...(full
      ? { dateStyle: 'long', timeStyle: 'short' }
      : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
  }).format(new Date(value));
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('');
export const searchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

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
};
export type Meeting = {
  id: string;
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

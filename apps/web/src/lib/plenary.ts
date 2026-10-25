import type { Meeting, Poll } from './types';
export type PlenarySession = {
  status: 'draft' | 'open' | 'closed';
  capacity: number;
  quorumPercent: number;
  electorIds: string[];
  moderatorIds: string[];
  activeTopic: number;
  sharedModerationAccepted: boolean;
  openedAt?: string;
  closedAt?: string;
};
export type PlenaryProvider = {
  configured: boolean;
  provider: 'kmeet';
  maxCapacity: number;
  moderation: 'shared';
};
export type PlenaryAttendee = {
  id: string;
  firstJoinedAt: string;
  lastSeenAt: string;
  active: boolean;
  connected: boolean;
  handRaised: boolean;
  excluded: boolean;
  verified: boolean;
  confirmedAt?: string;
};
export type PlenaryState = {
  meeting: Meeting;
  session: PlenarySession | null;
  provider: PlenaryProvider;
  canManage: boolean;
  canModerate: boolean;
  availableIds: string[];
  attendees: PlenaryAttendee[];
  present: number;
  quorum: number;
  quorumReached: boolean;
  polls: Poll[];
  serverTime: string;
};
export type Admission = {
  domain: 'kmeet.infomaniak.com';
  roomName: string;
  userName: string;
  canModerate: boolean;
  moderation: 'shared';
};

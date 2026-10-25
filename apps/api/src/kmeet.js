import { assert } from './domain.js';

export const KMEET_DOMAIN = 'kmeet.infomaniak.com';
export function kmeetProvider(env = {}) {
  return {
    provider: 'kmeet',
    configured: env.KMEET_ENABLED !== 'false',
    maxCapacity: 40,
    moderation: 'shared',
  };
}
export function kmeetAdmission(session, { name, canModerate }, env = {}) {
  assert(kmeetProvider(env).configured, 'O serviço de áudio está temporariamente desativado.', 503);
  assert(/^[0-9a-f-]{36}$/i.test(session.roomKey), 'Sala de áudio inválida.', 503);
  return {
    domain: KMEET_DOMAIN,
    roomName: `anade${session.roomKey.replaceAll('-', '')}`,
    userName: name,
    canModerate: !!canModerate,
    moderation: 'shared',
  };
}

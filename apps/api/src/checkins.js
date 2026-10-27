import sharp from 'sharp';
import { assert } from './domain.js';

export const electoralOffices = [
  'Presidente',
  'Vice-presidente',
  'Governador',
  'Vice-governador',
  'Deputado federal',
  'Deputado estadual',
  'Senador',
  'Prefeito',
  'Vice-prefeito',
  'Vereador',
  'Outro cargo eletivo',
];
export const CHECKIN_PAGE_SIZE = 20;
export const MAX_PROOF_BYTES = 1024 * 1024;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function brasiliaDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
// The participation day follows the game's 08:00 tick, not civil midnight.
export function checkinDay(now = new Date()) {
  return brasiliaDay(new Date(now.getTime() - 8 * 3600000));
}
export function checkinPeriod(now = new Date()) {
  const today = checkinDay(now);
  return {
    today,
    serverTime: now.toISOString(),
    resetsAt: new Date(Date.parse(`${today}T08:00:00-03:00`) + 86400000).toISOString(),
  };
}
export function checkinFilters(query, admin = false) {
  const page = query.page === undefined ? 0 : Number(query.page);
  assert(Number.isInteger(page) && page >= 0 && page <= 100000, 'Página inválida.');
  const day = query.day || '';
  assert(
    typeof day === 'string' &&
      (!day ||
        (/^\d{4}-\d{2}-\d{2}$/.test(day) &&
          !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) &&
          new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day)),
    'Data inválida.',
  );
  const memberId = admin ? query.memberId || '' : '';
  assert(typeof memberId === 'string' && memberId.length <= 100, 'Filiado inválido.');
  const office = admin ? query.office || '' : '';
  assert(
    typeof office === 'string' && (!office || electoralOffices.includes(office)),
    'Cargo inválido.',
  );
  return { page, day, memberId, office };
}
export function checkinFields(body) {
  assert(body?.confirmed === 'true', 'Confirme que concluiu as três ações e publicou no Blue.');
  const office = body.office || '';
  assert(
    typeof office === 'string' && (!office || electoralOffices.includes(office)),
    'Escolha um cargo eletivo válido ou deixe em branco.',
  );
  return { office };
}
export async function optimizeProof(buffer) {
  assert(
    buffer?.length && buffer.length <= MAX_UPLOAD_BYTES,
    'Cada print deve ter até 2 MB após a preparação.',
    413,
  );
  try {
    const image = sharp(buffer, { limitInputPixels: 24000000, failOn: 'error' });
    const metadata = await image.metadata();
    assert(
      ['png', 'jpeg', 'webp'].includes(metadata.format) &&
        (!metadata.pages || metadata.pages === 1),
      'Envie um print estático em PNG, JPG ou WebP.',
    );
    for (const quality of [88, 75, 60]) {
      const result = await image
        .clone()
        .rotate()
        .resize({ width: 2000, height: 5000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (result.length <= MAX_PROOF_BYTES) return result;
    }
    assert(false, 'O print ficou muito grande. Recorte a área necessária e tente novamente.', 413);
  } catch (error) {
    if (error.status) throw error;
    assert(false, 'Não foi possível ler esse print. Envie uma imagem PNG, JPG ou WebP válida.');
  }
}

export function presentCheckin(row) {
  return {
    id: row.id,
    memberId: row.account_id,
    day: row.day,
    createdAt: new Date(row.created_at).toISOString(),
    name: row.character_name,
    discord: row.discord_username,
    blue: row.blue,
    office: row.office,
    proofs: {
      actions: `/api/checkins/${row.id}/proofs/actions`,
      blue: `/api/checkins/${row.id}/proofs/blue`,
    },
  };
}

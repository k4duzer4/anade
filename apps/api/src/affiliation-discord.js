const endpoint = 'https://discord.com/api/v10';
const failed = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
export class AffiliationDiscord {
  constructor(env, origin, request = fetch) {
    this.env = env;
    this.origin = origin;
    this.request = request;
  }
  get configured() {
    return Boolean(
      this.env.DISCORD_BOT_TOKEN && this.env.DISCORD_GUILD_ID && this.env.DISCORD_MEMBER_ROLE_ID,
    );
  }
  async call(path, method, body) {
    let response;
    try {
      response = await this.request(endpoint + path, {
        method,
        headers: {
          Authorization: `Bot ${this.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw failed('DELIVERY_UNCONFIRMED');
    }
    const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (response.status === 429)
      throw failed('DISCORD_RATE_LIMITED', {
        retryAfter: Math.min(
          86400,
          Math.max(
            1,
            Number(result.retry_after) || Number(response.headers.get('retry-after')) || 60,
          ),
        ),
      });
    if (response.status === 403 && result.code === 50007) throw failed('DM_BLOCKED');
    if (response.status === 401) throw failed('BOT_TOKEN_INVALID');
    if (response.status === 403) throw failed('BOT_PERMISSION_DENIED');
    if (response.status === 404) throw failed('DISCORD_MEMBER_OR_RESOURCE_MISSING');
    if (!response.ok)
      throw failed(response.status >= 500 ? 'DELIVERY_UNCONFIRMED' : 'DISCORD_REJECTED');
    return result;
  }
  async send(record, kind) {
    if (!this.configured) throw failed('BOT_NOT_CONFIGURED');
    if (kind === 'role') {
      await this.call(
        `/guilds/${this.env.DISCORD_GUILD_ID}/members/${record.accountId}/roles/${this.env.DISCORD_MEMBER_ROLE_ID}`,
        'PUT',
      );
      return {};
    }
    const channel = await this.call('/users/@me/channels', 'POST', {
      recipient_id: record.accountId,
    });
    if (!/^\d{17,20}$/.test(channel.id || '')) throw failed('DISCORD_REJECTED');
    const message = await this.call(`/channels/${channel.id}/messages`, 'POST', {
      content: `Sua filiação à ANADE no RPG Legado foi aprovada pela administração. Você já pode acessar o portal: ${this.origin}/painel\nEsta é uma mensagem sobre sua solicitação de filiação.`,
      allowed_mentions: { parse: [] },
      nonce: record.id.replaceAll('-', '').slice(0, 25),
      enforce_nonce: true,
    });
    if (!message.id) throw failed('DELIVERY_UNCONFIRMED');
    return { messageId: message.id };
  }
}
export async function deliverAffiliation(store, bot, id, kinds, now, allowUnknown = false) {
  const record = await store.get(id);
  for (const kind of kinds) {
    const claimId = crypto.randomUUID();
    const claim = await store.delivery(id, kind, (previous) => {
      if (!previous || previous.state === 'sent') return null;
      if (previous.state === 'unknown' && !allowUnknown) return null;
      if (previous.state === 'sending') {
        // Uma interrupção após o envio não autoriza repetir automaticamente a mensagem.
        if (Date.parse(previous.startedAt) + 60000 > now().getTime()) return null;
        return { ...previous, state: 'unknown', error: 'DELIVERY_UNCONFIRMED', claimId: null };
      }
      if (previous.retryAt && Date.parse(previous.retryAt) > now().getTime()) return null;
      return {
        state: 'sending',
        attempts: previous.attempts + 1,
        startedAt: now().toISOString(),
        claimId,
      };
    });
    if (claim?.claimId !== claimId) continue;
    let result;
    try {
      result = { state: 'sent', ...(await bot.send(record, kind)), sentAt: now().toISOString() };
    } catch (error) {
      result = {
        state:
          error.code === 'DELIVERY_UNCONFIRMED'
            ? 'unknown'
            : error.code === 'BOT_NOT_CONFIGURED'
              ? 'pending'
              : 'failed',
        error: error.code || 'DISCORD_REJECTED',
        ...(error.retryAfter
          ? { retryAt: new Date(now().getTime() + error.retryAfter * 1000).toISOString() }
          : {}),
      };
    }
    await store.delivery(id, kind, (previous) =>
      previous.claimId === claimId ? { ...result, attempts: claim.attempts } : null,
    );
  }
}

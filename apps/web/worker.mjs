import nextWorker from './.open-next/worker.js';

const worker = {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (
      path === '/api' ||
      path.startsWith('/api/') ||
      path === '/auth' ||
      path.startsWith('/auth/')
    ) {
      const headers = new Headers(request.headers);
      headers.set('X-Forwarded-Proto', new URL(request.url).protocol.slice(0, -1));
      headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '127.0.0.1');
      return env.API.fetch(new Request(request, { headers }));
    }
    return nextWorker.fetch(request, env, ctx);
  },
};
export default worker;

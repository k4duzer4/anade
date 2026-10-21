import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    env: { TZ: 'America/Sao_Paulo' },
    include: ['test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
  },
});

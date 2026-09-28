import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Files share Postgres, Redis (BullMQ queue) and MediaMTX: run them one at a time.
    fileParallelism: false,
    // Own BullMQ queue, so a running dev server's worker doesn't take the test jobs.
    env: { BULLMQ_PREFIX: 'padel-e2e' },
  },
});

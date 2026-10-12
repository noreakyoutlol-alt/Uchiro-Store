import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      KHPAY_TEST_MODE: 'true',
    },
  },
});

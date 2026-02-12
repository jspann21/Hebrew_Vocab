import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Hebrew_Vocab/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/features/**/*.ts', 'src/lib/**/*.ts'],
    },
  },
});

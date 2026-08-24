/// <reference types="vitest" />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [angular()],
  build: {
    sourcemap: true,
  },
  test: {
    globals: true,
    dir: 'src',
    setupFiles: ['src/test-setup.ts'],
    environment: 'jsdom',
    maxConcurrency: 1,
    bail: 10, // Stop after 10 test failures
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: [
        '**/*.config.*',
        'node_modules/',
        '.nuxt/',
        'dist/',
        'src/environments/',
        'src/app/testing/mocks/',
      ],
      all: false,
      clean: true,
    },
  },
  resolve: {
    conditions: ['default', 'node'],
    alias: {
      src: path.resolve(__dirname, './src'),
      'package.json': path.resolve(__dirname, './package.json'),
    },
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));

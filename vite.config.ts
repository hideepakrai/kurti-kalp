import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Prevents development/test-only mock connectors and catalog fixtures
 * (`src/testing/*`) from ever entering connected production client bundles (`dist/`).
 */
function stripTestingFixturesInProdBuild(isBuild: boolean): Plugin {
  const virtualId = '\0virtual:empty-mock-connector';
  return {
    name: 'strip-testing-fixtures-in-prod',
    resolveId(source) {
      if (!isBuild) return null;
      if (
        source.includes('testing/mock-connector') ||
        source.includes('testing/fixtures')
      ) {
        return virtualId;
      }
      return null;
    },
    load(id) {
      if (id === virtualId) {
        return 'export const defaultMockConnector = null; export const LocalMockStorefrontConnector = null;';
      }
      return null;
    },
  };
}

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  return {
    plugins: [
      stripTestingFixturesInProdBuild(isBuild),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

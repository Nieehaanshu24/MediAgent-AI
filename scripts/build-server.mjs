/**
 * Bundles the Express server entry (server.ts) into a single ESM file that
 * `node server/index.js` can run in production. External npm packages are left
 * as runtime imports (they live in node_modules inside the Docker image); only
 * the local ./server/** graph is inlined.
 */
import { build } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const options = {
  entryPoints: ['server.ts'],
  // Emit to a dedicated dir so the bundle never mixes with server/ source,
  // which the Dockerfile also copies for reference.
  outfile: 'server-dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Keep all external (npm) deps unbundled; resolve them from node_modules at runtime.
  packages: 'external',
  // The Dockerfile runs `node server-dist/index.js` from WORKDIR /app, so __dirname
  // computed in server.ts resolves to /app/server-dist. Keep source maps for debuggability.
  sourcemap: true,
  banner: {
    js: '// Built by scripts/build-server.mjs — do not edit directly.',
  },
  logLevel: 'info',
};

if (isWatch) {
  const { context } = await import('esbuild');
  const ctx = await context(options);
  await ctx.watch();
  console.log('[build-server] Watching for changes...');
} else {
  await build(options);
  console.log('[build-server] Server bundled to server-dist/index.js');
}

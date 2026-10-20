// Builds the offline demo: the real app, with the Supabase client and the RAWG/TMDB catalog swapped for
// in-browser stand-ins, bundled into a single HTML file.  Run: npm run build:demo  →  dist-demo/index.html
import { resolve } from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

const SWAP = {
  [resolve(__dirname, '../src/lib/supabase.js')]: resolve(__dirname, 'mock-supabase.js'),
  [resolve(__dirname, '../src/lib/catalog.js')]: resolve(__dirname, 'mock-catalog.js')
};

export default {
  root: __dirname,
  publicDir: false,
  define: { 'import.meta.env.VITE_MEMORY_ROUTER': JSON.stringify('true') },
  plugins: [
    {
      name: 'demo-swap',
      enforce: 'pre',
      async resolveId(source, importer, opts) {
        const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
        return r && SWAP[r.id] ? SWAP[r.id] : null;
      }
    },
    viteSingleFile()
  ],
  build: { outDir: resolve(__dirname, '../dist-demo'), emptyOutDir: true }
};

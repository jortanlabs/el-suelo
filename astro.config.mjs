// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // URL canónica del sitio — usada para construir URLs absolutas en OG tags.
  site: 'https://elsuelo.es',
  output: 'server',
  adapter: vercel(),
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});

// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // URL canónica del sitio — usada para construir URLs absolutas en OG tags.
  // Si compras un dominio nuevo (p. ej. elsuelo.es) cámbialo aquí.
  site: 'https://el-suelo.app',
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

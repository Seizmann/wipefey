import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Client-side app. Static routes are pre-rendered by scripts/prerender.mjs
  // into dist/ after `vite build` (see package.json "build:static").
  // The serverless function lives in /api (Vercel convention) and is NOT
  // part of this Vite build.
})

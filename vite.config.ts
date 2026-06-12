import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/Cipher/',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        includeAssets: ['favicon.svg', 'favicon.ico', 'favicon-96x96.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Cipher',
          short_name: 'Cipher',
          description: 'End-to-end encrypted messaging with text, file, and voice support',
          theme_color: '#2563eb',
          background_color: '#111111',
          display: 'standalone',
          scope: '/Cipher/',
          start_url: '/Cipher/',
          share_target: {
            action: '/Cipher/share-target',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
              files: [
                {
                  name: 'sharedFiles',
                  accept: [
                    'image/*',
                    'audio/*',
                    'video/*',
                    'text/*',
                    'application/pdf',
                    'application/json',
                    'application/zip',
                    'application/octet-stream',
                    '.ctx',
                    '.txt',
                    '.json',
                    '.pdf',
                    '.zip',
                    '.rar',
                    '.7z',
                  ],
                },
              ],
            },
          },
          icons: [
            { src: 'web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        },
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

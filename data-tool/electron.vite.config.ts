import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const sharedAlias = { '@shared': resolve('src/shared') }

/**
 * Inject the renderer Content-Security-Policy at serve/build time rather than hard-coding it in
 * index.html. The shipped app gets a strict policy (`style-src 'self'`); the dev server additionally
 * allows 'unsafe-inline' styles, which Vite injects for HMR. Keeping it out of the HTML source lets
 * prod stay strict without breaking dev.
 */
function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    transformIndexHtml(html, ctx) {
      const styleSrc = ctx.server ? "'self' 'unsafe-inline'" : "'self'"
      const content = `default-src 'self'; img-src 'self' data:; style-src ${styleSrc}; script-src 'self'`
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content },
            injectTo: 'head-prepend'
          }
        ]
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias }
  },
  renderer: {
    resolve: {
      alias: {
        ...sharedAlias,
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), cspPlugin()]
  }
})

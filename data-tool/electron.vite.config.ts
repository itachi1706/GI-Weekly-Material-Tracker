import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const sharedAlias = { '@shared': resolve('src/shared') }

/**
 * Inject a strict renderer Content-Security-Policy into the PRODUCTION index.html (rather than
 * hard-coding it in the HTML source). `apply: 'build'` means the dev server is left unconstrained —
 * Vite's HMR needs inline scripts/styles and blob workers, so a strict CSP only makes sense for the
 * shipped app, which loads nothing but its own bundled assets.
 */
function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const content = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'"
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

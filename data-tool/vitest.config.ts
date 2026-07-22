import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Unit tests for the pure logic (shared serializer/validator/schema/ordering) and the wiki text
// parsers. Node environment — none of these touch the DOM. Aliases mirror electron.vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // `lcov` → coverage/lcov.info for SonarCloud (see sonar-project.properties); `text` for local runs.
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/shared/**/*.ts', 'src/main/ipc/wiki.ts'],
      exclude: ['src/**/*.test.ts', 'src/shared/types.ts']
    }
  }
})

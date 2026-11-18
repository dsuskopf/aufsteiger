import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

/** Aus welchem Commit und welchem Projektordner diese App gebaut wurde – Grundlage für „Update verfügbar?“ */
function buildCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const BUILD_INFO = {
  __BUILD_COMMIT__: JSON.stringify(buildCommit()),
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  __PROJECT_DIR__: JSON.stringify(resolve(__dirname)),
  // „github“ setzt der Release-Build (GitHub Actions): Updates dann aus den GitHub-Releases statt aus dem Projektordner
  __UPDATE_SOURCE__: JSON.stringify(process.env['AUFSTEIGER_UPDATE_SOURCE'] === 'github' ? 'github' : 'project')
}

export default defineConfig({
  main: {
    define: BUILD_INFO,
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})

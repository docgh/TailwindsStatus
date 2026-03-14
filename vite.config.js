import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uiRoot = path.resolve(__dirname, 'src/ui')
const uiAssetsDir = path.resolve(uiRoot, 'assets')
const distDir = path.resolve(uiRoot, '../../dist')

function copyUiAssetsPlugin() {
  return {
    name: 'copy-ui-assets',
    closeBundle() {
      const distAssetsDir = path.resolve(distDir, 'assets')
      fs.mkdirSync(distAssetsDir, { recursive: true })
      fs.cpSync(uiAssetsDir, distAssetsDir, { recursive: true })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  root: uiRoot,
  plugins: [react(), copyUiAssetsPlugin()],
  build: {
    outDir: '../../dist',
    rollupOptions: {
      input: {
        main: path.resolve(uiRoot, 'index.html'),
        maint: path.resolve(uiRoot, 'maint.html'),
        sms: path.resolve(uiRoot, 'sms_signup.html')
      }
    }
  }
})

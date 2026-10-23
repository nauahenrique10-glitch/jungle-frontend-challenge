import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
 plugins: [react(), tailwindcss()],
 resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
 // Generated traces/reports are not source files. Windows may lock ZIPs while they are copied.
 server: { watch: { ignored: ['**/.artifacts/**', '**/test-results/**', '**/playwright-report/**'] } },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Without this, Vite binds to whichever address "localhost" resolves to
    // first (IPv4 or IPv6, OS-dependent) — leaving the OTHER one connection-
    // refused. `true` listens on all interfaces so both localhost and
    // 127.0.0.1 (and the LAN, if needed) reach the dev server.
    host: true,
  },
})

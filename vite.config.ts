import { networkInterfaces } from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getPrivateNetworkUrls(port: number) {
  const interfaces = networkInterfaces()
  const urls: string[] = []

  for (const interfaceEntries of Object.values(interfaces)) {
    for (const entry of interfaceEntries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(entry.address)) continue
      urls.push(`http://${entry.address}:${port}`)
    }
  }

  return Array.from(new Set(urls))
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  define: {
    __SFMS_NETWORK_PUBLIC_APP_URLS__: JSON.stringify(command === 'serve' ? getPrivateNetworkUrls(5173) : []),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
}))

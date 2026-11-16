import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const abs = (p) => fileURLToPath(new URL(p, import.meta.url)).replace(/\\/g, '/')

// `--mode demo` swaps the two Firebase-backed modules for in-memory stand-ins
// (see src/demo/). The app then runs with sample data and no Firebase project.
const demoAlias = [
  { find: /^.*\/hooks\/useFirestore(\.js)?$/, replacement: abs('./src/demo/firestore.js') },
  { find: /^.*\/context\/AuthContext(\.jsx)?$/, replacement: abs('./src/demo/AuthContext.jsx') },
]

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: mode === 'demo' ? demoAlias : [],
  },
  build: {
    outDir: mode === 'demo' ? 'dist-demo' : 'dist',
    sourcemap: false,
  },
}))

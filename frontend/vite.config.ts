/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from parent directory (project root)
  const env = loadEnv(mode, resolve(__dirname, '..'), '')
  
  return {
    plugins: [react()],
    
    // Make environment variables available to the app
    define: {
      global: 'globalThis',
    },
    
    // Environment variables configuration
    envDir: resolve(__dirname, '..'), // Load .env from parent directory (project root)
    
    // Development server configuration
    server: {
      proxy: {
        // Proxy API requests to FastAPI backend
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Add Vitest configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      css: true,
    },

    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
          },
        },
      },
    },

    // Path aliases for organized imports
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@pages': resolve(__dirname, './src/pages'),
        '@types': resolve(__dirname, './src/types'),
        '@utils': resolve(__dirname, './src/utils'),
      },
    },

    // Optimized dependency pre-bundling
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  }
}) 
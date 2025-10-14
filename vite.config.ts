import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

/**
 * Dev File Override Plugin
 * 
 * Automatically uses *.dev.ts versions of files in development when they exist.
 * Example: If you import 'constants.ts' and 'constants.dev.ts' exists, the dev version is used.
 * 
 * Usage:
 * 1. Create a .dev.ts version of any file you want to override locally
 * 2. Add *.dev.ts to .gitignore (so it stays local)
 * 3. The plugin automatically swaps files in development mode
 */
function devFileOverridePlugin() {
  return {
    name: 'dev-file-override',
    enforce: 'pre' as const,
    resolveId(source: string, importer: string | undefined) {
      // Only apply in development mode
      if (process.env.NODE_ENV !== 'development') return null;
      
      // Only process relative or aliased imports
      if (!importer) return null;
      
      // Resolve the full path
      let resolvedPath: string;
      
      if (source.startsWith('@/')) {
        // Handle @ alias imports
        resolvedPath = path.resolve(__dirname, 'src', source.slice(2));
      } else if (source.startsWith('.')) {
        // Handle relative imports
        resolvedPath = path.resolve(path.dirname(importer), source);
      } else {
        // Skip node_modules and other imports
        return null;
      }
      
      // Add .ts extension if not present
      if (!resolvedPath.endsWith('.ts') && !resolvedPath.endsWith('.tsx')) {
        // Try both .ts and .tsx
        if (fs.existsSync(resolvedPath + '.ts')) {
          resolvedPath = resolvedPath + '.ts';
        } else if (fs.existsSync(resolvedPath + '.tsx')) {
          resolvedPath = resolvedPath + '.tsx';
        } else {
          return null;
        }
      }
      
      // Check if a .dev.ts/.dev.tsx version exists
      const devPath = resolvedPath.replace(/\.(ts|tsx)$/, '.dev.$1');
      
      if (fs.existsSync(devPath)) {
        console.log(`🔧 Dev override: Using ${path.basename(devPath)} instead of ${path.basename(resolvedPath)}`);
        return devPath;
      }
      
      return null;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    devFileOverridePlugin()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    open: true
  }
})

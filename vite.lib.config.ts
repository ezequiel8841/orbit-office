import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import dts from "vite-plugin-dts";

// All packages that hosts almost certainly already have — keep them external
// so the orbit-office bundle stays lightweight (no duplication).
const PEER_EXTERNALS = [
  // React core
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  // Radix UI — exhaustive list so subpaths are covered
  /^@radix-ui\//,
  // Icons
  "lucide-react",
  // Charts
  "recharts",
  // Form
  "react-hook-form",
  "@hookform/resolvers",
  /^@hookform\//,
  "zod",
  // Dates
  "date-fns",
  "react-day-picker",
  // UI extras
  "sonner",
  "vaul",
  "cmdk",
  "embla-carousel-react",
  /^embla-carousel/,
  "react-resizable-panels",
  "next-themes",
  "input-otp",
  // Tailwind helpers (tiny but also likely in host)
  "clsx",
  "class-variance-authority",
  "tailwind-merge",
  "tailwindcss-animate",
  // Router / query (host-owned)
  "@tanstack/react-query",
  "react-router-dom",
];

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src/packages/**", "src/packages-optional/**"],
      exclude: ["**/*.css"],
      outDir: "dist/types",
      insertTypesEntry: true,
      tsconfigPath: "./tsconfig.lib.json",
      skipDiagnostics: true,
      // Don't copy .d.ts files from dependencies — consumers resolve them from
      // their own node_modules via the peerDep contract.
      copyDtsFiles: false,
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    lib: {
      // Multiple entry points: main bundle + io subpath entries.
      // io-* entries are excluded from the main bundle so the host's bundler
      // only parses the OOXML generators when explicitly imported.
      entry: {
        "orbit-office": path.resolve(__dirname, "src/packages/index.ts"),
        "io-docx": path.resolve(__dirname, "src/packages-optional/docx-io/index.ts"),
        "io-pptx": path.resolve(__dirname, "src/packages-optional/pptx-io/index.ts"),
        "io-xlsx": path.resolve(__dirname, "src/packages-optional/xlsx-io/index.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryAlias) =>
        `${entryAlias}.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: PEER_EXTERNALS,
      treeshake: {
        // Only CSS imports have side effects; all JS modules are pure.
        // This enables the consumer's bundler to eliminate unused re-exports.
        moduleSideEffects: (id) => /\.css$/.test(id),
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
        preserveModules: false,
      },
    },
    // Target modern environments — avoids unnecessary legacy transforms/polyfills.
    target: "es2020",
    // esbuild minification: ~60% smaller output, faster parse time for consumers.
    minify: "esbuild",
    // Source maps inflate the published package and force the consumer's bundler
    // to allocate extra memory while processing the library.
    sourcemap: false,
    outDir: "dist",
    cssCodeSplit: false,
    // Skip gzip size calculation — not needed for library builds.
    reportCompressedSize: false,
  },
});

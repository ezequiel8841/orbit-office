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
      tsconfigPath: "./tsconfig.json",
      skipDiagnostics: true,
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/packages/index.ts"),
      name: "OrbitOffice",
      formats: ["es", "cjs"],
      fileName: (format) => `orbit-office.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: PEER_EXTERNALS,
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
        // Preserve module structure for tree-shaking
        preserveModules: false,
      },
    },
    outDir: "dist",
    sourcemap: true,
    cssCodeSplit: false,
  },
});

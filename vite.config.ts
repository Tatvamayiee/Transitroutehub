import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Vite configuration for Transit Route Hub.
 *
 * Plugins, in order: Tailwind v4, tsconfig path resolution, TanStack Start (file
 * based routes plus the SSR pipeline, with the server entry pointed at
 * src/server.ts — our SSR error wrapper), Nitro for production builds only, and
 * finally React.
 *
 * Nitro bundles the built SSR handler into `.output/`. The preset is
 * `cloudflare-module` by default; Vercel sets `VERCEL=1` during its own builds,
 * so that target is selected when the variable is present.
 */
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ command, mode }) => {
  // Mirror the VITE_* variables from .env into the client bundle.
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": srcDir },
      // One copy of React and of the TanStack query core, whatever pulls them in.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Keep server-only modules out of the browser bundle.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Route TanStack Start's bundled server entry through src/server.ts.
        server: { entry: "server" },
      }),
      // Nitro runs for builds only: on `vite dev` TanStack Start serves the SSR
      // handler itself, and Nitro's config is a deployment concern.
      ...(command === "build"
        ? [
            nitro({
              defaultPreset: "cloudflare-module",
              ...(process.env["VERCEL"] ? { preset: "vercel" } : {}),
            }),
          ]
        : []),
      react(),
    ],
    server: { host: "::", port: 8080 },
  };
});

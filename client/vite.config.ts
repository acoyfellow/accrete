import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { foldkit } from "@foldkit/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

const isDocsDirectory = (path: string): boolean => path === "/docs" || (path.startsWith("/docs/") && path.endsWith("/"));

const docsIndex = (): Plugin => ({
  name: "accrete-docs-index",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = (request.url ?? "").split("?")[0] ?? "";
      if (!isDocsDirectory(path)) return next();
      const file = join(PUBLIC_DIR, path.endsWith("/") ? path : `${path}/`, "index.html");
      if (!existsSync(file)) return next();
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(readFileSync(file));
    });
  },
});

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [docsIndex(), foldkit(), tailwindcss()],
  base: "/",
  build: { outDir: "../public", emptyOutDir: true },
  server: { port: 5281, strictPort: true, proxy: { "/api": "http://localhost:8799" } },
});

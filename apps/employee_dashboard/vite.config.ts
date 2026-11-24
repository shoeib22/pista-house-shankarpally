import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The built dashboard talks only to its own origin, so it can forbid everything
// else. A script injected into a page can then neither load more code nor send
// the staff session token anywhere but our own API. Production builds only:
// the dev server needs inline scripts for hot reload.
const contentSecurityPolicy = (): Plugin => ({
  name: "pista-content-security-policy",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      injectTo: "head-prepend",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
        ].join("; "),
      },
    },
    {
      tag: "meta",
      injectTo: "head-prepend",
      attrs: { name: "referrer", content: "no-referrer" },
    },
  ],
});

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  server: {
    proxy: {
      "/api": {
        target: process.env.PISTA_API_PROXY || "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});

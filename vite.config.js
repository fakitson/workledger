import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)),
  },
  server: {
    port: 5199,
  },
});

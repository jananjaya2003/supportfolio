import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./vite-plugins/local-api";

export default defineConfig({
  plugins: [react(), localApiPlugin()],
});

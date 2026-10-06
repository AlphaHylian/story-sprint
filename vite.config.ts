/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Project Pages sites are served from https://<user>.github.io/<repo>/,
// so assets must be requested from /<repo>/. BASE_PATH lets a fork or a
// custom domain override it at build time (use "/" for a custom domain).
export default defineConfig({
  base: process.env.BASE_PATH ?? "/story-sprint/",
  build: { target: "es2022" },
  test: { environment: "node" },
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const repositoryName = env.GITHUB_REPOSITORY?.split("/")[1];
  const base =
    env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : "/";

  return {
    base,
    plugins: [react(), tailwindcss()],
  };
});

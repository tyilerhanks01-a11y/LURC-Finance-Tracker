import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Version = total commit count, so it auto-increments with every push. Falls
// back to "0" if git isn't available (e.g. a build without repo history).
function getBuildNumber() {
  try {
    return execSync("git rev-list --count HEAD").toString().trim();
  } catch {
    return "0";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(getBuildNumber()),
  },
});

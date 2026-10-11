import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { realpathSync } from "node:fs";
const app = fileURLToPath(new URL("../../", import.meta.url));
const navigation = path.join(app, "tests/browser/navigation.tsx");
// Worktree dependency installs may be junctions outside this checkout. Vite
// resolves font imports to the real path, so allow the installed dependency
// directory as well as the test application root.
const dependencies = realpathSync(path.join(app, "node_modules"));
const server = await createServer({
  configFile: false,
  root: path.join(app, "tests/browser"),
  publicDir: path.join(app, "public"),
  resolve: {
    alias: [
      { find: "@", replacement: path.join(app, "src") },
      { find: "next/link", replacement: navigation },
      { find: "next/navigation", replacement: navigation },
      {
        find: "@clerk/nextjs",
        replacement: path.join(app, "tests/browser/clerk.tsx"),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5191,
    strictPort: true,
    fs: { allow: [app, dependencies] },
  },
});
await server.listen();
console.log("Test-only component server: http://127.0.0.1:5191");

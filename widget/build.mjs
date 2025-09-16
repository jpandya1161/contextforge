// Bundles widget/embed.ts into public/widget.js as a self-contained IIFE
// with no external dependencies, so it can be dropped into any third-party
// page with a single <script> tag. Run via `npm run widget:build` (also
// wired into `npm run build`, so it always regenerates before `next build`
// copies public/ into the production output).
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(dir, "embed.ts")],
  outfile: path.join(dir, "..", "public", "widget.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  logLevel: "info",
});

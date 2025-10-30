import { build } from "tsup";
import { copyFileSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

// Build ESM
await build({
  entry: ["src/index.ts"],
  outDir: "dist",
  target: "node18",
  format: ["esm"],
  clean: true,
  dts: true,
  minify: false,
  shims: true,
  splitting: false,
  skipNodeModulesBundle: true,
  outExtension: () => ({ js: ".js", dts: ".d.ts" }),
});

// Build CJS
await build({
  entry: ["src/index.ts"],
  outDir: "dist/cjs",
  target: "node18",
  format: ["cjs"],
  dts: false,
  minify: false,
  shims: true,
  splitting: false,
  skipNodeModulesBundle: true,
});

// Copy .d.mts to .d.ts
copyFileSync(
  join(process.cwd(), "dist", "index.d.mts"),
  join(process.cwd(), "dist", "index.d.ts")
);

// Simplify di() return type for proper TypeScript inference
// This fixes the complex Elysia type that obscures BuildServicesObject
const dtsPath = join(process.cwd(), "dist", "index.d.ts");
let content = readFileSync(dtsPath, "utf-8");

const diStartPattern =
  /declare function di<const Services[^]+?(?=\n\nexport|$)/;

if (diStartPattern.test(content)) {
  content = content.replace(
    diStartPattern,
    `declare function di<const Services extends readonly ServiceRegistration[], const Classes extends readonly ClassRegistration[], const Instances extends readonly InstanceRegistration[]>(options?: DIOptions<Services, Classes, Instances>): Elysia<'', {
    decorator: Record<string, never>;
    store: Record<string, never>;
    derive: BuildServicesObject<[...Services, ...Classes, ...Instances]>;
    resolve: Record<string, never>;
  }>`
  );

  writeFileSync(dtsPath, content);
  console.log("✓ Build completed successfully");
} else {
  throw new Error("Could not find di() function declaration to simplify");
}

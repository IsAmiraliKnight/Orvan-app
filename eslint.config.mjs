import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // `out*` rather than `out`: the blank build for testers is exported beside it
  // as `out 2`, and linting minified output is noise either way.
  { ignores: [".next/**", "out*/**", "node_modules/**", "next-env.d.ts"] },
];

export default eslintConfig;

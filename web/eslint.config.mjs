import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Projetos nativos do Capacitor (onda 14): java/swift + artefatos de
    // build do Gradle (ex.: native-bridge.js copiado pro APK) nao sao
    // codigo lintavel nosso.
    "android/**",
    "ios/**",
    "capacitor/**",
  ]),
]);

export default eslintConfig;

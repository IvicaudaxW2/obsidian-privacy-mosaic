import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: [
      "node_modules/",
      "dist/",
      "main.js",
      "eslint.config.js",
      "eslint.config.mjs",
      "esbuild.config.mjs",
      "*.d.ts"
    ]
  },

  ...obsidianmd.configs.recommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd()
      },
      globals: {
        document: "readonly",
        Node: "readonly",
        NodeFilter: "readonly",
        HTMLElement: "readonly",
        HTMLSpanElement: "readonly",
        MouseEvent: "readonly",
        Element: "readonly",
        Text: "readonly"
      }
    },
    rules: {
      "obsidianmd/sample-names": "off",
      "@typescript-eslint/no-deprecated": "off"
    }
  }
]);

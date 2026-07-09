import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "docs/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "func-names": ["error", "never"],
      // CBOR decodes to untyped structures; the parsers type them at the boundary.
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);

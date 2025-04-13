import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["dist/**", "node_modules/**"], // 👈 מתעלם מתיקיות build
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: globals.node, // אם אתה עובד ב-backend עם Node.js
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // 👈 מבטל את האיסור על any
      "@typescript-eslint/no-require-imports": "off", // 👈 אם אתה משתמש ב-require איפשהו
      "no-undef": "off", // 👈 מסיר שגיאות על exports, require וכו'
    },
  },
];

module.exports = [
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    ignores: ["node_modules/**"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {},
  },
];

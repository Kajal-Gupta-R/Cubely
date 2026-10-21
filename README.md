# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Cube solving

Cubely converts its face editor state into cubing.js 3×3×3 cubie coordinates,
validates physical legality first, and verifies each returned standard face-turn
sequence by replaying it against the editor state. The solver uses the
`experimentalSolve3x3x3IgnoringCenters` API; its algorithm and performance may
change with future cubing.js releases. A 30-second timeout reports failure, but
the library does not expose cancellation, so timed-out worker computation may
continue in the background. Phase 5 displays the sequence only; move playback
is not included. The cubing.js package is licensed under MPL-2.0 OR
GPL-3.0-or-later; review its licensing terms for your distribution.

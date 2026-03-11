# Contributing

Thank you for your interest in contributing to CSEdge Port Manager.

## Current Status

This document is a placeholder contribution guide for the public repository stage of the project.

## Contribution Expectations

- Open an issue before large architectural or product changes
- Keep pull requests scoped and clearly described
- Preserve cross-platform behavior for macOS, Linux, and Windows
- Maintain TypeScript strictness and modular separation across `services`, `ui`, and `commands`
- Include documentation updates when behavior changes

## Local Validation

Before opening a pull request, contributors should verify:

```bash
npm install
npm run build
npx @vscode/vsce package --no-yarn
```

## Ownership

Maintained by **CSEdge**  
Developed by **Durgesh Vaigandla**

// metro.config.js
// Fixes "Cannot use import.meta outside a module" on Expo web.
//
// Root cause: Zustand's package.json exports map routes the "import"
// condition to ESM .mjs files that contain import.meta. On web Metro
// matches "import" and loads those files, crashing the browser.
//
// Fix: custom resolveRequest forces Zustand (and its sub-paths) to
// always resolve to their CJS .js builds on web.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const zustandRoot = path.resolve(__dirname, 'node_modules/zustand');

// Map of zustand import paths → their CJS counterparts
const ZUSTAND_CJS = {
  'zustand':             path.join(zustandRoot, 'index.js'),
  'zustand/vanilla':     path.join(zustandRoot, 'vanilla.js'),
  'zustand/middleware':  path.join(zustandRoot, 'middleware.js'),
  'zustand/shallow':     path.join(zustandRoot, 'shallow.js'),
  'zustand/traditional': path.join(zustandRoot, 'traditional.js'),
  'zustand/react':       path.join(zustandRoot, 'react', 'index.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && ZUSTAND_CJS[moduleName]) {
    return { filePath: ZUSTAND_CJS[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

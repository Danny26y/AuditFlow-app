const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support sqlite extensions and wasm if used on web
config.resolver.sourceExts.push('sql');

module.exports = config;

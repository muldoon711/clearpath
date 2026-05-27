const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    assetExts: ['glb', 'gltf', 'png', 'jpg', 'ttf', 'otf', 'pbf'],
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

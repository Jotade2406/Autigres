module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required for react-native-reanimated worklet transformation (v3 and v4).
    // Must be listed LAST among plugins.
    plugins: ['react-native-reanimated/plugin'],
  };
};

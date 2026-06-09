module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) auto-applies the worklets/reanimated transform.
    presets: ["babel-preset-expo"],
  };
};

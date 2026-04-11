module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transforms import.meta → compatible browser/CJS code.
      // Required because @supabase/supabase-js uses import.meta in its
      // ESM build, which Metro cannot handle on web without this transform.
      'babel-plugin-transform-import-meta',
    ],
  };
};

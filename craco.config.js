module.exports = {
  style: {
    postcss: {
      // A plain array here gets concatenated onto CRA's own default postcss
      // plugins (postcss-preset-env, postcss-normalize, ...) rather than
      // replacing them - with tailwindcss running last in that chain, its
      // @tailwind directives never actually expanded, so no utility classes
      // ever made it into the build. A function return value replaces CRA's
      // chain outright instead of appending to it.
      plugins: () => [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
};

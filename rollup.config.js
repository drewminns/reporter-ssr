import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import globals from 'rollup-plugin-node-globals';
import notify from 'rollup-plugin-notify';
import sizes from 'rollup-plugin-sizes';
import autoPreprocess from 'svelte-preprocess';
// import postcss from 'postcss';
import postcss from 'rollup-plugin-postcss';
import { terser } from 'rollup-plugin-terser';

const isDev = Boolean(process.env.ROLLUP_WATCH);

const postCSSPlugins = [
  require('autoprefixer')({
    browsers: ['>0.25%', 'not ie 11', 'not op_mini all'],
  }),
];

const sveltePreprocess = autoPreprocess({
  plugins: postCSSPlugins,
});

export default [
  // Browser bundle
  {
    input: 'src/main.js',
    output: {
      sourcemap: true,
      format: 'iife',
      name: 'app',
      file: 'public/bundle.js',
    },
    plugins: [
      svelte({
        // enable run-time checks when not in production
        dev: isDev,
        hydratable: true,
        // we'll extract any component CSS out into
        // a separate file — better for performance
        preprocess: sveltePreprocess,
        css: css => {
          css.write('public/bundle.css');
        },
      }),
      postcss({
        extract: 'public/global.css',
        minimize: !isDev,
        sourceMap: isDev,
        plugins: postCSSPlugins,
      }),
      resolve(),
      commonjs(),
      globals(),
      sizes(),
      notify(),
      // App.js will be built after bundle.js, so we only need to watch that.
      // By setting a small delay the Node server has a chance to restart before reloading.
      isDev &&
        livereload({
          watch: 'public/App.js',
          delay: 200,
        }),
      !isDev && terser(),
    ],
  },
  // Server bundle
  {
    input: 'src/App.svelte',
    output: {
      sourcemap: false,
      format: 'cjs',
      name: 'app',
      file: 'public/App.js',
    },
    plugins: [
      svelte({
        preprocess: sveltePreprocess,
        generate: 'ssr',
      }),
      resolve(),
      commonjs(),
      globals(),
      !isDev && terser(),
    ],
  },
];

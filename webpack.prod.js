const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackMd5Hash = require('webpack-md5-hash');
const paths = require('../paths');
const createWebpackConfig = require('./webpack.base');

const plugins = paths.appTemplate
  ? [
    new HtmlWebpackPlugin({
      template: `raw-loader!${paths.appTemplate}`,
      filename: path.join(paths.appBuild, 'template.ejs'),
      inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
  ]
  : [];

const jsLoader = {
  test: /\.js$/, // Transform all .js files required somewhere with Babel.
  rules: [
    {
      use: [
        {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            extends: require.resolve('../../.babelrc'),
            // This is a feature of `babel-loader` for webpack (not Babel itself).
            // It enables caching results in ./node_modules/.cache/babel-loader/
            // directory for faster rebuilds.
            cacheDirectory: true,
          },
        },
      ],
    },
  ],
  include: paths.appSrc,
};

const clientConfig = createWebpackConfig({
  entry: [
    // We ship a few polyfills by default.
    require.resolve('../polyfills'),
    paths.appEntryClient || paths.appEntry,
  ],
  // Utilize long-term caching by adding content hashes (not compilation hashes)
  // to compiled assets.
  output: {
    filename: '[name].[chunkhash].js',
    chunkFilename: '[name].[chunkhash].chunk.js',
    pathinfo: true,
    path: path.join(paths.appBuild, 'public'),
    publicPath: paths.publicPath,
  },
  rules: [
    jsLoader,
    {
      test: /\.css$/,
      use: ExtractTextPlugin.extract({
        fallback: 'style-loader',
        use: 'css-loader?minimize',
      }),
    },
  ],
  plugins: plugins.concat([
    // OccurrenceOrderPlugin is needed for long-term caching to work properly.
    new webpack.optimize.OccurrenceOrderPlugin(true),
    // Minify and optimize the JavaScript.
    new webpack.optimize.UglifyJsPlugin({
      output: {
        comments: false,
      },
      compress: {
        warnings: false,
        screw_ie8: true,
      },
      mangle: {
        screw_ie8: true,
        except: ['Drupal'],
      },
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
      children: true,
      minChunks: 2,
      async: true,
    }),
    new WebpackMd5Hash(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      __CLIENT__: true,
      __SERVER__: false,
      __DEVELOPMENT__: false,
      __PRODUCTION__: true,
    }),
    new ExtractTextPlugin({
      filename: '[name].[contenthash].css',
      allChunks: true,
    }),
    // Always expose NODE_ENV to webpack, in order to use `process.env.NODE_ENV`
    // inside your code for any environment checks; UglifyJS will automatically
    // drop any unreachable code.
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'production'),
      },
    }),
  ]),
});

module.exports = [clientConfig];

if (paths.appEntryClient && paths.appEntryServer) {
  const serverConfig = createWebpackConfig({
    target: 'node',
    resolveMainFields: ['node', 'module', 'main'],
    entry: [
      // We ship a few polyfills by default.
      require.resolve('../polyfills'),
      paths.appEntryServer,
    ],
    output: {
      filename: 'server.js',
      libraryTarget: 'commonjs2',
      path: path.resolve(process.cwd(), 'build'),
      publicPath: paths.publicPath,
    },
    rules: [
      jsLoader,
      {
        test: /\.css$/,
        use: ['ignore-loader'],
      },
    ],
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        // Disable code splitting on the server.
        maxChunks: 1,
      }),
      new webpack.DefinePlugin({
        __CLIENT__: false,
        __SERVER__: true,
        __DEVELOPMENT__: false,
        __PRODUCTION__: true,
      }),
      // Always expose NODE_ENV to webpack, in order to use `process.env.NODE_ENV`
      // inside your code for any environment checks; UglifyJS will automatically
      // drop any unreachable code.
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'production'),
        },
      }),
    ],
  });

  module.exports = [clientConfig, serverConfig];
}

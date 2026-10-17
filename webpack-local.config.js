const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');

const common = require('./webpack-common.config');

const mode = 'development';
module.exports = merge(common, {
  mode,

  devServer: {
    compress: true,
    static: {
      directory: path.join(__dirname, 'www'),
      publicPath: '/',
    },
    host: '0.0.0.0',
    port: '3002',
    hot: true,
    historyApiFallback: {
      index: '/',
    },
    // `npm run dev:api` (wrangler) serves the API
    proxy: [{ context: ['/api'], target: 'http://localhost:8787' }],
  },

  devtool: 'inline-cheap-source-map',

  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        VERSION: JSON.stringify('development'),
      },
    }),
  ],
});

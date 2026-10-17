const webpack = require('webpack');
const { merge } = require('webpack-merge');
const path = require('path');

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
    client: {
      overlay: false,
    },
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

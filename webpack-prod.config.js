const webpack = require('webpack');
const { merge } = require('webpack-merge');

const { version } = require('./package.json');
const common = require('./webpack-common.config');

const mode = 'production';
module.exports = merge(common, {
  mode,

  optimization: {
    minimize: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        VERSION: JSON.stringify(version),
      },
    }),
  ],
});

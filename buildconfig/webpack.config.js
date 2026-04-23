const path = require('path')

module.exports = {
  entry: './dist/index.js',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        // Emscripten glue code uses node:fs for WASM loading in Node.js;
        // in a browser bundle we stub it out so webpack doesn't choke.
        scheme: 'node',
        type: 'asset/source',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      fs: false,
      path: false,
    },
  },
  externals: {
    'node:fs': 'commonjs fs',
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist-wp'),
  },
}

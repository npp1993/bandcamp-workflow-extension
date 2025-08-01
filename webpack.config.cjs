const CopyPlugin = require('copy-webpack-plugin');
const isProduction = process.env.NODE_ENV === 'production';
const path = require('path');



module.exports = (env) => {
  const getBrowserFlavour = () => {
    if (env.chrome === true) {
      return 'chrome';
    } else if (env.firefox === true) {
      return 'firefox';
    }
  };

  return {
    watch: !isProduction,
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'inline-source-map',
    entry: {
      'scripts/content': './src/app/content.ts',
      'scripts/background': './src/app/background.ts',
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    output: {
      path: path.resolve(__dirname, `dist/${getBrowserFlavour()}`),
    },
    node: false,
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: `./src/manifest-${getBrowserFlavour()}.json`,
            to: 'manifest.json',
          },
          {
            from: './src/assets',
            to: 'assets',
          },
          {
            from: './src/icons',
            to: 'icons',
            globOptions: {
              ignore: ['**/*.sh', '**/*.py'],
            },
          },
        ],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.js$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
  };
};

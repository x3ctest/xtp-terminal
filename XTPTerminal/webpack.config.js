const path = require('path');
const { VueLoaderPlugin } = require('vue-loader')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const isProd = process.argv.indexOf('--mode=production') >= 0;
var webpack = require('webpack');

module.exports = [
    {
        target: "node",
        node: {
            //fs: 'empty', net: 'empty', tls: 'empty',
            //child_process: 'empty', dns: 'empty',
            global: true,__dirname: true
        },
        entry: ['./src/extension.ts'],
        output: {
            path: path.resolve(__dirname, 'out'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '[absoluteResourcePath]'
        },
        externals: {
            vscode: 'commonjs vscode',
            ssh2: 'commonjs ssh2', 
            'cpu-features': 'commonjs cpu-features',
            zeromq: 'commonjs zeromq', 
            'cmake-ts': 'commonjs cmake-ts'
        },
        resolve: {
            extensions: ['.ts', '.js', '.node'],
            alias: {
                '@': path.resolve(__dirname, './src')
            },
            fallback: {
                path: require.resolve('path-browserify'),
                fs: 'empty', // 排除 fs 模块（ssh2 依赖但无需打包）
                net: 'empty',
                tls: 'empty'
            }
        },
        plugins: [
            new webpack.IgnorePlugin({resourceRegExp: /^(cardinal|encoding|aws4)$/}),
            new CopyWebpackPlugin({
                patterns: [{ from: 'bin', to: './bin' }]
            }),
        ],
        module: { rules: [{ test: /\.ts$/, exclude: /(node_modules|bin)/, use: ['ts-loader'] }] },
        optimization: { minimize: isProd },
        watch: !isProd,
        mode: isProd ? 'production' : 'development',
        devtool: isProd ? false : 'source-map',
    },
    {
        entry: {
            app: './src/vue/main.js'
        },
        plugins: [
            new VueLoaderPlugin(),
            new HtmlWebpackPlugin({ inject: true, template: './public/index.html', chunks: ['app'], filename: 'webview/app.html' }),
            new CopyWebpackPlugin({
                patterns: [{ from: 'public', to: './webview' }]
            }),
        ],
        output: {
            path: path.resolve(__dirname, 'out'),
            filename: 'webview/js/[name].js'
        },
        resolve: {
            extensions: ['.vue', '.js'],
            alias: { 'vue$': 'vue/dist/vue.esm.js', '@': path.resolve('src'), }
        },
        module: {
            rules: [
                { test: /\.vue$/, loader: 'vue-loader', options: { loaders: { css: ["vue-style-loader", "css-loader"] } } },
                { test: /(\.css|\.cssx)$/, use: ["vue-style-loader", "css-loader"] },
                { test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/, loader: 'url-loader', options: { limit: 80000 } }
            ]
        },
        optimization: {
            minimize: isProd,
            splitChunks: {
                cacheGroups: {
                    antv: { name: "antv", test: /[\\/]@antv[\\/]/, chunks: "all", priority: 10 },
                    vendor: { name: "vendor", test: /[\\/]node_modules[\\/]/, chunks: "all", priority: -1 }
                }
            }
        },
        watch: !isProd,
        mode: isProd ? 'production' : 'development',
        devtool: isProd ? false : 'source-map',
    }
];
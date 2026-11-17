/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'blocks-perf',
    title: 'Blocks performance',

    entryPoints: {
        app: './src/App.tsx',
    },

    viteConfigExtensions: './vite.config.mts',
}

module.exports = config

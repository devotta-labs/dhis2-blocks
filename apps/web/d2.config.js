/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',

    entryPoints: {
        app: './src/AppWrapper.tsx',
    },

    viteConfigExtensions: './vite.config.mts',

    i18n: {
        additionalSourcePaths: ['../../packages/registry'],
    },
}

module.exports = config

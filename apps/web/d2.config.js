// oxlint-disable-next-line landmines-style/no-comments -- Preserve the functional type annotation on a CommonJS export.
/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',

    entryPoints: {
        app: './src/AppWrapper.tsx',
    },

    viteConfigExtensions: './vite.config.mts',
}

module.exports = config

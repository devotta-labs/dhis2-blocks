import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { defineConfig, ConfigEnv } from 'vite'

const viteConfig = defineConfig(async (configEnv: ConfigEnv) => {
    const { mode } = configEnv
    const workspaceAliases =
        mode === 'development'
            ? [
                  {
                      find: /^@dhis2-blocks\/working-list$/,
                      replacement: path.resolve(
                          __dirname,
                          '../../packages/working-list/src/index.ts'
                      ),
                  },
              ]
            : []
    return {
        // In dev environments, don't clear the terminal after files update
        clearScreen: mode !== 'development',
        resolve: {
            alias: workspaceAliases,
        },
        plugins: [tailwindcss()],
        // ...other config options here
    }
})

export default viteConfig

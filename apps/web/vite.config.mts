import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { defineConfig, ConfigEnv } from 'vite'

const viteConfig = defineConfig(async (configEnv: ConfigEnv) => {
    const { mode } = configEnv
    const workspaceAliases =
        mode === 'development'
            ? [
                  {
                      find: /^@dhis2-blocks\/working-list\/style\.css$/,
                      replacement: path.resolve(
                          __dirname,
                          '../../packages/working-list/src/ui/working-list.css'
                      ),
                  },
                  {
                      find: /^@dhis2-blocks\/working-list\/url-state$/,
                      replacement: path.resolve(
                          __dirname,
                          '../../packages/working-list/src/url-state.ts'
                      ),
                  },
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
        // Use an import alias: import from '@/' anywhere instead of 'src/'
        resolve: {
            alias: [
                ...workspaceAliases,
                { find: '@', replacement: path.resolve(__dirname, 'src') },
            ],
        },
        plugins: [tailwindcss()],
        // ...other config options here
    }
})

export default viteConfig

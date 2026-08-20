import config from '@dhis2/config-eslint'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig([
    includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
    {
        extends: [config],
    },
    {
        settings: {
            // react-router v7 resolves through its package "exports" map,
            // which the classic node resolver can't follow, so import/named
            // would false-positive on every react-router-dom named export.
            'import/ignore': ['react-router'],
        },
    },
])

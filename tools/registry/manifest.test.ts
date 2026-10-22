import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { importedSpecifiers } from './manifest.ts'

test('TypeScript reads imports and re-exports without treating comments or strings as imports', () => {
    const source = `
        // import { Ghost } from 'comment-only'
        /* export { Ghost } from 'block-comment-only' */
        const example = "import { Ghost } from 'string-only'"
        import React from 'react'
        import type { Props } from './types'
        export { Button } from './button'
        export * from './helpers'
        import './styles.css'
        const lazy = import('./lazy')
    `
    assert.deepEqual(importedSpecifiers(source), [
        'react',
        './types',
        './button',
        './helpers',
        './styles.css',
        './lazy',
    ])
})

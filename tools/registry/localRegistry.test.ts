import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareLocalRegistry } from './localRegistry.ts'

test('local installs rewrite only same-repository dependency addresses', (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'local-registry-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const theme = {
        name: 'dhis2-theme',
        type: 'registry:theme',
        cssVars: { theme: { 'color-dhis2-primary': '#1565c0' } },
    }
    const component = {
        name: 'example',
        type: 'registry:ui',
        registryDependencies: [
            'devotta-labs/dhis2-blocks/dhis2-theme',
            'button',
            '@other/example',
            'another/repository/item#v1',
            'https://example.com/r/item.json',
        ],
        files: [
            {
                path: 'example.tsx',
                type: 'registry:ui',
                content: '// devotta-labs/dhis2-blocks/dhis2-theme',
                target: '@components/example.tsx',
            },
        ],
    }
    writeFileSync(
        join(directory, 'registry.json'),
        JSON.stringify({
            name: 'test',
            homepage: 'https://example.com',
            items: [theme, component],
        })
    )
    writeFileSync(join(directory, 'dhis2-theme.json'), JSON.stringify(theme))
    writeFileSync(join(directory, 'example.json'), JSON.stringify(component))

    const items = prepareLocalRegistry(directory)
    const expected = {
        ...component,
        registryDependencies: [
            join(directory, 'dhis2-theme.json'),
            ...component.registryDependencies.slice(1),
        ],
    }
    assert.deepEqual(
        JSON.parse(readFileSync(join(directory, 'example.json'), 'utf8')),
        expected
    )
    assert.deepEqual(items[1].files, component.files)
    assert.deepEqual(items[0].cssVars, theme.cssVars)

    writeFileSync(
        join(directory, 'example.json'),
        JSON.stringify({
            ...component,
            registryDependencies: ['devotta-labs/dhis2-blocks/missing'],
        })
    )
    assert.throws(
        () => prepareLocalRegistry(directory),
        /Missing local registry dependency/
    )

    writeFileSync(
        join(directory, 'example.json'),
        JSON.stringify({ ...component, type: 'invalid' })
    )
    assert.throws(() => prepareLocalRegistry(directory), /Invalid/)
})

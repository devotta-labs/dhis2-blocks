import assert from 'node:assert/strict'
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { buildRegistry } from './buildRegistry.ts'
import { REPO_ROOT, registryAliases } from './layout.ts'
import { prepareLocalRegistry } from './localRegistry.ts'
import { importedSpecifiers, packageName } from './manifest.ts'

test('ordered source aliases agree with each project TS mapping, not the installed consumer', () => {
    const aliases = registryAliases()
    assert.equal(
        aliases.find(({ find }) =>
            '@/components/dhis2/ui/button'.startsWith(find)
        )?.replacement,
        join(REPO_ROOT, 'packages/registry/components')
    )
    for (const project of ['apps/docs', 'apps/web', 'packages/registry']) {
        const config = JSON.parse(
            readFileSync(join(REPO_ROOT, project, 'tsconfig.json'), 'utf8')
        )
        for (const { find, replacement } of aliases) {
            assert.deepEqual(
                config.compilerOptions.paths[`${find}/*`].map((path: string) =>
                    resolve(REPO_ROOT, project, path)
                ),
                [`${replacement}/*`]
            )
        }
    }
    const consumer = readFileSync(
        join(REPO_ROOT, 'tools/registry/consumer/tsconfig.json'),
        'utf8'
    )
    assert.ok(!consumer.includes('packages/registry'))
})

test('generation resolves sibling components, block subpaths and package subpaths and rejects broken owners', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'registry-layout-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const write = (path: string, content: string) => {
        const target = join(root, 'packages/registry', path)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, content)
    }
    write('components/theme.css', '@theme { --color-dhis2-primary: blue; }')
    write('components/cn.ts', 'export const cn = () => ""')
    write(
        'components/button.tsx',
        'import { cn } from "./cn"; import "@base-ui/react/button"; import "react/jsx-runtime"'
    )
    write(
        'blocks/example/block.json',
        JSON.stringify({ title: 'Example', description: 'Example' })
    )
    write(
        'blocks/other/block.json',
        JSON.stringify({ title: 'Other', description: 'Other' })
    )
    write('blocks/other/index.ts', 'export const value = 1')
    write(
        'blocks/example/index.ts',
        'import "@/components/dhis2/ui/button"; import "@/components/other/index"'
    )
    write(
        'package.json',
        JSON.stringify({ dependencies: { '@base-ui/react': '1.0.0' } })
    )
    let registry = buildRegistry(root)
    assert.deepEqual(
        registry.items.find(({ name }) => name === 'button')?.dependencies,
        ['@base-ui/react@1.0.0']
    )
    assert.ok(
        registry.items
            .find(({ name }) => name === 'button')
            ?.registryDependencies?.includes('devotta-labs/dhis2-blocks/cn')
    )
    assert.ok(
        registry.items
            .find(({ name }) => name === 'example')
            ?.registryDependencies?.includes('devotta-labs/dhis2-blocks/other')
    )
    write('blocks/example/index.ts', 'import "../other/index"')
    assert.throws(() => buildRegistry(root), /import it as/)
    write('blocks/example/index.ts', 'import "@/components/missing"')
    assert.throws(() => buildRegistry(root), /unknown item/)
    write('blocks/example/index.ts', 'import "./missing"')
    assert.throws(() => buildRegistry(root), /not an installed file/)
    write('blocks/example/index.ts', 'import "@/lib/utils"')
    assert.throws(() => buildRegistry(root), /resolve once installed/)
    write('blocks/example/index.ts', 'export const value = 1')
    registry = buildRegistry(root)
    assert.equal(
        registry.items.find(({ name }) => name === 'example')?.files?.[0]
            .target,
        '@components/example/index.ts'
    )
})

test('local rewriting only changes same-repository dependencies and rejects missing items', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'registry-rewrite-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const item = {
        name: 'button',
        type: 'registry:ui',
        registryDependencies: [
            'devotta-labs/dhis2-blocks/cn',
            'https://example.com/other.json',
            '@external/button',
        ],
    }
    const cn = { name: 'cn', type: 'registry:ui' }
    writeFileSync(
        join(root, 'registry.json'),
        JSON.stringify({
            name: 'test',
            homepage: 'https://example.com',
            items: [item, cn],
        })
    )
    writeFileSync(join(root, 'button.json'), JSON.stringify(item))
    writeFileSync(join(root, 'cn.json'), JSON.stringify(cn))
    assert.deepEqual(prepareLocalRegistry(root)[0].registryDependencies, [
        join(root, 'cn.json'),
        'https://example.com/other.json',
        '@external/button',
    ])
    writeFileSync(
        join(root, 'button.json'),
        JSON.stringify({
            ...item,
            registryDependencies: ['devotta-labs/dhis2-blocks/missing'],
        })
    )
    assert.throws(
        () => prepareLocalRegistry(root),
        /Missing local registry dependency/
    )
})

test('manifest sees reexports and dynamic imports without turning subpaths into packages', () => {
    assert.deepEqual(
        importedSpecifiers(
            'export { Button } from "@base-ui/react/button"; import("lodash/map")'
        ),
        ['@base-ui/react/button', 'lodash/map']
    )
    assert.equal(packageName('@base-ui/react/button'), '@base-ui/react')
    assert.equal(packageName('lodash/map'), 'lodash')
})

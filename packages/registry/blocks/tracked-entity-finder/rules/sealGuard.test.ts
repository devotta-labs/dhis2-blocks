import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockDir = fileURLToPath(new URL('..', import.meta.url))
const NOT_SHIPPED = new Set(['__tests__', 'type-tests', 'node_modules'])
const sealModule = join(blockDir, 'rules', 'seal')
/** Static, dynamic and side-effect imports, re-exports and requires. */
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"`]([^'"`]+)['"`]/g

const importsSeal = (path: string, source: string): boolean =>
    [...source.matchAll(SPECIFIER)].some(([, spec]) => {
        const target = spec.startsWith('.')
            ? resolve(dirname(path), spec)
            : spec
        return (
            target.replace(/\.tsx?$/, '') === sealModule ||
            /(?:^|\/)rules\/seal(?:\.tsx?)?$/.test(target)
        )
    })

const shippedSources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            return NOT_SHIPPED.has(entry.name) ? [] : shippedSources(path)
        }
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
            ? [path]
            : []
    })

describe('seal', () => {
    it.each([
        "import { seal } from '../rules/seal'",
        "export { seal } from '@/components/tracked-entity-finder/rules/seal'",
        "import('../rules/seal.ts')",
        "require('../rules/seal')",
        "import '../rules/seal'",
    ])('detects a seal-constructor dependency: %s', (source) => {
        expect(
            importsSeal(join(blockDir, 'provider', 'example.ts'), source)
        ).toBe(true)
    })

    it.each([
        "import type { ValidatedSearch } from '../rules/types'",
        "import { runSearch } from '../api/search'",
        "import { sealLabel } from '../rules/sealLabel'",
    ])('allows non-constructor dependencies: %s', (source) => {
        expect(
            importsSeal(join(blockDir, 'provider', 'example.ts'), source)
        ).toBe(false)
    })

    it('only rules modules import seal', () => {
        const importers = shippedSources(blockDir)
            .filter((path) => importsSeal(path, readFileSync(path, 'utf8')))
            .map((path) => relative(blockDir, path).split(sep).join('/'))

        expect(importers.filter((path) => !path.startsWith('rules/'))).toEqual(
            []
        )
    })
})

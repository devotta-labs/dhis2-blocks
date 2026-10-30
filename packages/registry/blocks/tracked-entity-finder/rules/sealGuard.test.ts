import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockDir = fileURLToPath(new URL('..', import.meta.url))
const NOT_SHIPPED = new Set(['__tests__', 'type-tests', 'node_modules'])
const sealModule = join(blockDir, 'rules', 'seal')
/** Static, dynamic and side-effect imports, re-exports and requires. */
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"`]([^'"`]+)['"`]/g

const importsSeal = (path: string): boolean =>
    [...readFileSync(path, 'utf8').matchAll(SPECIFIER)].some(([, spec]) => {
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
    it('only rules modules import seal', () => {
        const importers = shippedSources(blockDir)
            .filter(importsSeal)
            .map((path) => relative(blockDir, path).split(sep).join('/'))

        // The scan works: the rule module that seals searches is found.
        expect(importers).toContain('rules/evaluateForm.ts')
        expect(importers.filter((path) => !path.startsWith('rules/'))).toEqual(
            []
        )
    })
})

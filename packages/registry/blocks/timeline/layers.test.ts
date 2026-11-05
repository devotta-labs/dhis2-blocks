import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DHIS2 = join(ROOT, 'dhis2')

const sourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
            return path === DHIS2 ? [] : sourceFiles(path)
        }
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
            ? [path]
            : []
    })

const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"`]([^'"`]+)['"`]/g

const importsDhis2 = (file: string, source: string) =>
    [...source.matchAll(SPECIFIER)]
        .map(([, specifier]) => specifier)
        .filter((specifier) => {
            let target: string
            if (specifier.startsWith('.')) {
                target = resolve(dirname(file), specifier)
            } else if (specifier.startsWith('@/components/')) {
                target = resolve(
                    ROOT,
                    '..',
                    specifier.slice('@/components/'.length)
                )
            } else {
                return false
            }
            return target === DHIS2 || target.startsWith(`${DHIS2}${sep}`)
        })

test.each([
    "import { useEventEntries } from '../dhis2/hooks/useEventEntries'",
    "export * from '@/components/timeline/dhis2'",
    "import('@/components/timeline/dhis2/hooks/useEventEntries')",
    "import '../dhis2'",
    "require('@/components/timeline/dhis2')",
])('detects a prohibited dependency: %s', (source) => {
    expect(importsDhis2(join(ROOT, 'ui', 'Example.tsx'), source)).toHaveLength(
        1
    )
})

test.each([
    "import { TimelineEntry } from '../core/types'",
    "import { Timeline } from '@/components/timeline'",
    "import { Button } from '@/components/dhis2/ui/button'",
    "import { example } from '../dhis2-example'",
])('allows a generic dependency: %s', (source) => {
    expect(importsDhis2(join(ROOT, 'ui', 'Example.tsx'), source)).toEqual([])
})

// The generic timeline installs and runs without its DHIS2 layer, so a host
// with its own data can delete `dhis2/`.
test('nothing outside dhis2/ imports from it', () => {
    const offenders = sourceFiles(ROOT).flatMap((file) =>
        importsDhis2(file, readFileSync(file, 'utf8')).map(
            (specifier) => `${relative(ROOT, file)} → ${specifier}`
        )
    )
    expect(offenders).toEqual([])
})

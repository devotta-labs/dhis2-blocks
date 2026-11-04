import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DHIS2 = join(ROOT, 'dhis2')

const sourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
            return path === DHIS2 ? [] : sourceFiles(path)
        }
        return /\.tsx?$/.test(entry.name) ? [path] : []
    })

const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

// The generic timeline installs and runs without its DHIS2 layer, so a host
// with its own data can delete `dhis2/`.
test('nothing outside dhis2/ imports from it', () => {
    const offenders = sourceFiles(ROOT).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(SPECIFIER)]
            .map(([, specifier]) => specifier)
            .filter(
                (specifier) =>
                    specifier.startsWith('.') &&
                    resolve(dirname(file), specifier).startsWith(DHIS2)
            )
            .map((specifier) => `${relative(ROOT, file)} → ${specifier}`)
    )
    expect(offenders).toEqual([])
})

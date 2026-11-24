import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BLOCK = fileURLToPath(new URL('..', import.meta.url))

const sources = readdirSync(BLOCK)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => ({ name, code: readFileSync(join(BLOCK, name), 'utf8') }))

describe('visit viewer boundaries', () => {
    it('reads its own source files', () => {
        expect(sources.map(({ name }) => name)).toContain('index.ts')
    })

    it.each(sources)(
        '$name never fetches or reads DHIS2 metadata',
        ({ code }) => {
            expect(code).not.toMatch(
                /@dhis2\/app-runtime|@tanstack\/react-query|useDataQuery|fetch\(/
            )
        }
    )

    it.each(sources)(
        '$name never routes a stored date through Date',
        ({ code }) => {
            expect(code).not.toMatch(/new Date\(|Date\.parse\(/)
        }
    )
})

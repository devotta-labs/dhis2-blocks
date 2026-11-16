import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const blocks = fileURLToPath(
    new URL('../../../../packages/registry/blocks', import.meta.url)
)
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

const hasComponents = (dir: string): boolean =>
    readdirSync(dir, { withFileTypes: true }).some((entry) =>
        entry.isDirectory()
            ? entry.name !== '__tests__' &&
              hasComponents(`${dir}/${entry.name}`)
            : entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
    )

test('Tailwind scans every block with components, so its classes exist in the docs', () => {
    const missing = readdirSync(blocks, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map(({ name }) => name)
        .filter((name) => hasComponents(`${blocks}/${name}`))
        .filter(
            (name) =>
                !css.includes(
                    `@source '../../../packages/registry/blocks/${name}';`
                )
        )
    expect(missing).toEqual([])
})

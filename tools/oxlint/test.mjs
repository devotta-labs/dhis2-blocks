import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rulesDirectory = new URL('./rules/', import.meta.url)

const tests = [
    new URL('./anti-slop/test.mjs', import.meta.url),
    ...readdirSync(rulesDirectory)
        .filter((name) => name.endsWith('.test.ts'))
        .sort()
        .map((name) => new URL(name, rulesDirectory)),
]

for (const test of tests) {
    const result = spawnSync(
        process.execPath,
        ['--experimental-strip-types', fileURLToPath(test)],
        { stdio: 'inherit' }
    )

    if (result.error) throw result.error

    if (result.status !== 0) process.exit(result.status ?? 1)
}

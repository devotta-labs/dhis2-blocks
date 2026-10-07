import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rulesDirectory = new URL('./rules/', import.meta.url)
const tests = readdirSync(rulesDirectory)
    .filter((name) => name.endsWith('.test.ts'))
    .sort()

for (const test of tests) {
    const result = spawnSync(
        process.execPath,
        ['--experimental-strip-types', fileURLToPath(new URL(test, rulesDirectory))],
        { stdio: 'inherit' }
    )
    if (result.error) {
        throw result.error
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1)
    }
}

console.log(`Passed ${tests.length} anti-slop rule suites.`)

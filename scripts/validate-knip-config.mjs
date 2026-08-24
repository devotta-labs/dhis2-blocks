import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const knipConfig = JSON.parse(
    await readFile(new URL('../knip.json', import.meta.url), 'utf8')
)
const d2Config = require('../apps/web/d2.config.js')

const exportIssueTypes = [
    'exports',
    'types',
    'nsExports',
    'nsTypes',
    'enumMembers',
    'namespaceMembers',
]

const appConfig = knipConfig.workspaces['apps/web']
const packageConfig = knipConfig.workspaces['packages/*']

assert.equal(
    knipConfig.treatConfigHintsAsErrors,
    true,
    'Knip configuration hints must fail the audit'
)
assert.equal(packageConfig.includeEntryExports, true)

for (const configuredEntry of Object.values(d2Config.entryPoints)) {
    const entry = configuredEntry.replace(/^\.\//, '')
    assert(
        appConfig.entry.includes(entry),
        `Knip must include DHIS2 entry ${entry}`
    )

    for (const issueType of exportIssueTypes) {
        assert(
            appConfig.ignoreIssues[entry]?.includes(issueType),
            `The framework-consumed DHIS2 entry ${entry} must exempt ${issueType}`
        )
    }
}

for (const issueType of exportIssueTypes) {
    assert.equal(
        knipConfig.rules[issueType],
        'warn',
        `${issueType} must remain warning-only during staged adoption`
    )
    assert(
        packageConfig.ignoreIssues['src/index.ts'].includes(issueType),
        `The public src/index.ts entry must exempt ${issueType}`
    )
}

const packageDirectories = await readdir(
    new URL('../packages', import.meta.url),
    { withFileTypes: true }
)

for (const directory of packageDirectories.filter((entry) =>
    entry.isDirectory()
)) {
    const packageJson = JSON.parse(
        await readFile(
            new URL(
                `../packages/${directory.name}/package.json`,
                import.meta.url
            ),
            'utf8'
        )
    )

    assert.equal(
        packageJson.exports['.'],
        './src/index.ts',
        `${packageJson.name} must keep src/index.ts as its public root entry`
    )
}

console.log('Knip configuration invariants are valid')

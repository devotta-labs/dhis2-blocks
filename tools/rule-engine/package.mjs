import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const engine = resolve(process.argv[2])
const parser = resolve(process.argv[3])
const staging = resolve(process.argv[4])
mkdirSync(staging, { recursive: true })
const distribution = join(engine, 'build/dist/js/productionLibrary')
for (const file of readdirSync(distribution)) {
    if (!file.endsWith('.mjs') && !file.endsWith('.d.mts')) continue
    const source = readFileSync(join(distribution, file), 'utf8')
    writeFileSync(join(staging, file), source.replace(/^\/\/# sourceMappingURL=.*$/gm, ''))
}
cpSync(join(parser, 'LICENSE'), join(staging, 'LICENSE'))
const engineLicense = readFileSync(join(engine, 'src/commonMain/kotlin/org/hisp/dhis/rules/models/RuleValidationResult.kt'), 'utf8').split('/*')[1].split('*/')[0].replace(/^\s*\* ?/gm, '').trim()
writeFileSync(join(staging, 'LICENSE-rule-engine'), engineLicense + '\n')
writeFileSync(join(staging, 'package.json'), JSON.stringify({
    name: '@dhis2/rule-engine', version: '3.8.6-custom.1', type: 'module',
    main: './rule-engine.mjs', types: './rule-engine.d.mts',
    exports: { '.': { types: './rule-engine.d.mts', default: './rule-engine.mjs' } },
    license: 'BSD-3-Clause', dependencies: { '@js-joda/core': '3.2.0' },
}, null, 2) + '\n')
execFileSync('npm', ['pack', '--pack-destination', join(root, 'vendor/rule-engine')], { cwd: staging, stdio: 'inherit' })

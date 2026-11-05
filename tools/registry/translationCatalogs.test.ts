import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { RegistryItem } from 'shadcn/schema'
import { buildRegistry } from './buildRegistry.ts'
import { ADDRESS_PREFIX, REPO_ROOT } from './layout.ts'
import {
    collectTranslationMarkers,
    generateTranslationCatalogs,
    translationSourceFiles,
} from './translationCatalogs.ts'

test('literal markers preserve injected text, validation templates, interpolation and context without translating metadata', () => {
    assert.deepEqual(
        collectTranslationMarkers(`
            i18n.t('Hello {{name}}', { name: metadata.displayName });
            translate('Injected'); t('Table cell');
            new ValueParseError('MULTI_TEXT contains an empty option code');
            i18n.t('Record', { context: 'verb', defaultValue: 'Record this' });
            i18n.t('Hello {{name}}', { name: otherName });
            i18n.t(message, values); translate(error.template, error.values);
            new Error('Not translated'); const metadata = { displayName: 'Original label' };
            // i18n.t('Not a call')
        `),
        [
            'i18n.t("Hello {{name}}")',
            'i18n.t("Injected")',
            'i18n.t("MULTI_TEXT contains an empty option code")',
            'i18n.t("Record", {"context":"verb","defaultValue":"Record this"})',
            'i18n.t("Table cell")',
        ]
    )
    assert.throws(
        () =>
            collectTranslationMarkers(`i18n.t('Record', { context: dynamic })`),
        /Nonliteral translation context/
    )
})

test('closure follows shared UI dependencies and composed Calendar without unrelated blocks', () => {
    const item = (name: string, dependencies: string[] = []): RegistryItem => ({
        name,
        type: 'registry:block',
        files: [
            {
                path: `${name}.tsx`,
                target: `src/${name}.tsx`,
                type: 'registry:file',
            },
        ],
        registryDependencies: dependencies.map(
            (value) => ADDRESS_PREFIX + value
        ),
    })
    const items = [
        item('working-list', ['button']),
        item('calendar', ['button']),
        item('button'),
        item('timeline'),
    ]
    assert.deepEqual(
        translationSourceFiles(items, ['working-list', 'calendar']),
        ['button.tsx', 'calendar.tsx', 'working-list.tsx']
    )
    assert.throws(
        () => translationSourceFiles(items, ['missing']),
        /Missing translation source item/
    )
    const files = translationSourceFiles(buildRegistry().items, [
        'working-list',
        'calendar',
    ])
    assert.ok(files.includes('packages/registry/components/button.tsx'))
    assert.ok(
        files.includes('packages/registry/blocks/calendar/CalendarGrid.tsx')
    )
    assert.ok(
        !files.some(
            (file) => file.includes('__tests__') || file.includes('.test.')
        )
    )
})

test('committed markers are fresh and cover the actual table, Calendar, selector and validation boundaries', () => {
    for (const { path, content } of generateTranslationCatalogs()) {
        assert.equal(readFileSync(path, 'utf8'), content)
    }
    const workingList = readFileSync(
        join(REPO_ROOT, 'apps/web/src/workingListTranslationCatalog.ts'),
        'utf8'
    )
    for (const key of [
        'Row has {{count}} data quality issues',
        '{{date}}, {{count}} records',
        'Context selector',
        'MULTI_TEXT contains an empty option code',
        'Image attachment',
    ])
        assert.ok(workingList.includes(key), key)
    assert.ok(
        !workingList.includes(
            'Choose visible columns and arrange their display order.'
        )
    )
})

test('d2 extraction and generation reconstruct underscore/context keys for an actual localized lookup', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'translation-extraction-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const source = join(root, 'src')
    const pot = join(root, 'i18n')
    const output = join(root, 'locales')
    mkdirSync(source)
    const markers = collectTranslationMarkers(`
        new ValueParseError('MULTI_TEXT contains an empty option code');
        translate('Hello {{name}}');
        i18n.t('Record', { context: 'verb' });
        i18n.t('Record_verb');
    `)
    writeFileSync(join(source, 'markers.ts'), markers.join('\n'))
    const cli = join(REPO_ROOT, 'apps/web/node_modules/.bin/d2-app-scripts')
    const cwd = join(REPO_ROOT, 'apps/web')
    execFileSync(cli, ['i18n', 'extract', '--path', source, '--output', pot], {
        cwd,
        stdio: 'pipe',
    })
    const extracted = readFileSync(join(pot, 'en.pot'), 'utf8')
    assert.match(
        extracted,
        /msgctxt "TEXT contains an empty option code"\nmsgid "MULTI"/
    )
    assert.match(extracted, /msgctxt "verb"\nmsgid "Record"/)
    writeFileSync(
        join(pot, 'nb.po'),
        `msgid ""
msgstr ""
"Language: nb\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

msgctxt "TEXT contains an empty option code"
msgid "MULTI"
msgstr "Flervalg mangler en kode"

msgid "Hello {{name}}"
msgstr "Hei {{name}}"

msgctxt "verb"
msgid "Record"
msgstr "Registrer"
`
    )
    execFileSync(cli, ['i18n', 'generate', '--path', pot, '--output', output], {
        cwd,
        stdio: 'pipe',
    })
    const translations = JSON.parse(
        readFileSync(join(output, 'nb/translations.json'), 'utf8')
    )
    assert.equal(
        translations['MULTI_TEXT contains an empty option code'],
        'Flervalg mangler en kode'
    )
    execFileSync(
        process.execPath,
        [
            '-e',
            `
        const assert = require('node:assert/strict');
        const i18n = require('@dhis2/d2-i18n').default;
        i18n.addResourceBundle('nb', 'translation', ${JSON.stringify(translations)});
        i18n.changeLanguage('nb');
        assert.equal(i18n.t('MULTI_TEXT contains an empty option code'), 'Flervalg mangler en kode');
        assert.equal(i18n.t('Hello {{name}}', { name: 'Ada' }), 'Hei Ada');
        assert.equal(i18n.t('Record', { context: 'verb' }), 'Registrer');
    `,
        ],
        { cwd, stdio: 'pipe' }
    )
})

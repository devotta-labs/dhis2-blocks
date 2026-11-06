import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Blocks, primitives and the docs examples people copy colour themselves with
// the semantic roles in theme.css only, so a theme can remap them.

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const ROOTS = [
    'packages/registry/components',
    'packages/registry/blocks',
    'apps/docs/src/examples',
]
const SOURCE = /\.tsx?$/
const SKIPPED = /\.test\.tsx?$|(?:^|\/)(?:__tests__|type-tests|fixtures)\//

const RAW_COLOURS: [string, RegExp][] = [
    [
        'palette step',
        /\bdhis2-(?:grey|blue|teal|red|yellow|green|purple)-\d{3}\b/,
    ],
    [
        'hex colour',
        /(?<![0-9A-Za-z&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/,
    ],
    ['rgb() colour', /\brgba?\(/],
    [
        'white or black utility',
        /\b(?:bg|text|border|outline|fill|stroke|ring|from|to|via|divide|placeholder|decoration|accent)-(?:white|black)\b/,
    ],
    ['palette variable', /var\(--color-dhis2-/],
]
const EXEMPTION = 'colour-literal:'

const TOKEN_USE =
    /\b(?:bg|text|border(?:-[trblxyse])?|outline|fill|stroke|ring-offset|inset-ring|ring|caret|from|to|via|divide|placeholder|decoration|accent|drop-shadow|text-shadow|shadow)-dhis2-([a-z][a-z0-9-]*?)(?![a-z0-9-])/g
const VARIABLE_USE = /\(--dhis2-([a-z][a-z0-9-]*)\)/g

/** Files that still hold raw colours. Each migration task removes its own. */
const PENDING = new Set<string>([
    'apps/docs/src/examples/observation-cards/ObservationCardsPlaceholders.tsx',
    'apps/docs/src/examples/tracker-data-entry/CohortAncRegister.tsx',
    'apps/docs/src/examples/tracker-data-entry/EventProgramGrid.tsx',
    'apps/docs/src/examples/tracker-data-entry/ImmunisationRegister.tsx',
    'apps/docs/src/examples/tracker-data-entry/PersonEventsGrid.tsx',
    'apps/docs/src/examples/tracker-data-entry/TrackerRegisterGrid.tsx',
    'apps/docs/src/examples/tracker-data-entry/ValueTypesGrid.tsx',
    'apps/docs/src/examples/ui/BadgeStatus.tsx',
    'apps/docs/src/examples/ui/ChartShare.tsx',
    'apps/docs/src/examples/ui/ChartTrend.tsx',
    'apps/docs/src/examples/ui/ChartVisits.tsx',
    'packages/registry/blocks/observation-cards/card/ObservationCard.tsx',
    'packages/registry/blocks/observation-cards/card/frame.tsx',
    'packages/registry/blocks/observation-cards/format/display.ts',
    'packages/registry/blocks/observation-cards/parts/ObservationChange.tsx',
    'packages/registry/blocks/observation-cards/parts/ObservationRecorded.tsx',
    'packages/registry/blocks/observation-cards/parts/ObservationSparkline.tsx',
    'packages/registry/blocks/observation-cards/parts/ObservationValue.tsx',
    'packages/registry/blocks/spreadsheet/cells/Cell.tsx',
    'packages/registry/blocks/spreadsheet/cells/CellStatus.tsx',
    'packages/registry/blocks/spreadsheet/cells/ChoiceCells.tsx',
    'packages/registry/blocks/spreadsheet/cells/OptionCell.tsx',
    'packages/registry/blocks/spreadsheet/cells/OptionList.tsx',
    'packages/registry/blocks/spreadsheet/cells/PopupCell.tsx',
    'packages/registry/blocks/spreadsheet/cells/TextCell.tsx',
    'packages/registry/blocks/spreadsheet/cells/editors/AgeEditor.tsx',
    'packages/registry/blocks/spreadsheet/cells/editors/CoordinateEditor.tsx',
    'packages/registry/blocks/spreadsheet/cells/editors/FileEditor.tsx',
    'packages/registry/blocks/spreadsheet/cells/editors/LongTextEditor.tsx',
    'packages/registry/blocks/spreadsheet/cells/editors/MultiSelectEditor.tsx',
    'packages/registry/blocks/spreadsheet/grid/BulkMenu.tsx',
    'packages/registry/blocks/spreadsheet/grid/ColumnPopover.tsx',
    'packages/registry/blocks/spreadsheet/grid/RowHeader.tsx',
    'packages/registry/blocks/spreadsheet/grid/RowNotes.tsx',
    'packages/registry/blocks/spreadsheet/grid/SpreadsheetGrid.tsx',
    'packages/registry/blocks/tracker-data-entry/provider/EventStatusBadge.tsx',
    'packages/registry/blocks/tracker-data-entry/provider/ShowMore.tsx',
    'packages/registry/blocks/tracker-data-entry/summary/TrackerDataEntrySummary.tsx',
])

const theme = readFileSync(
    join(REPO_ROOT, 'packages/registry/components/theme.css'),
    'utf8'
)
const utilityTokens = new Set(
    [...theme.matchAll(/--(?:color|shadow)-dhis2-([a-z0-9-]+)\s*:/g)].map(
        (match) => match[1]
    )
)
const runtimeVariables = new Set(
    [...theme.matchAll(/--dhis2-([a-z0-9-]+)\s*:/g)].map((match) => match[1])
)

const listSources = (directory: string): string[] =>
    readdirSync(join(REPO_ROOT, directory), { recursive: true })
        .map((entry) => join(directory, String(entry)))
        .filter((path) => SOURCE.test(path) && !SKIPPED.test(path))

const files = ROOTS.flatMap(listSources).sort()

const linesOf = (path: string): string[] =>
    readFileSync(join(REPO_ROOT, path), 'utf8').split('\n')

const rawColours = (path: string): string[] => {
    const lines = linesOf(path)
    return lines.flatMap((line, index) => {
        if (line.includes(EXEMPTION) || lines[index - 1]?.includes(EXEMPTION)) {
            return []
        }
        return RAW_COLOURS.filter(([, pattern]) => pattern.test(line)).map(
            ([label]) => `${path}:${index + 1} ${label}`
        )
    })
}

const unknownTokens = (path: string): string[] =>
    linesOf(path).flatMap((line, index) => [
        ...[...line.matchAll(TOKEN_USE)]
            .filter((match) => !utilityTokens.has(match[1]))
            .map((match) => `${path}:${index + 1} ${match[0]}`),
        ...[...line.matchAll(VARIABLE_USE)]
            .filter((match) => !runtimeVariables.has(match[1]))
            .map((match) => `${path}:${index + 1} ${match[0]}`),
    ])

describe('colour usage', () => {
    it('scans the registry and the docs examples', () => {
        expect(files.length).toBeGreaterThan(100)
    })

    it.each(files)('%s uses only semantic colour tokens', (path) => {
        if (PENDING.has(path)) return
        expect(rawColours(path)).toEqual([])
    })

    it.each(files)('%s names only defined tokens', (path) => {
        expect(unknownTokens(path)).toEqual([])
    })

    it('PENDING lists only files that still hold raw colours', () => {
        for (const path of PENDING) {
            expect(existsSync(join(REPO_ROOT, path))).toBe(true)
            expect(rawColours(path)).not.toEqual([])
        }
    })
})

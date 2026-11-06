import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Blocks, primitives and the docs examples people copy colour themselves with
// the semantic roles in theme.css only, so a theme can remap them.

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const ROOTS = [
    'packages/registry/components',
    'packages/registry/blocks',
    'apps/docs/src/examples',
    'apps/docs/src/pages',
]
const SOURCE = /\.(?:tsx?|css|mdx?)$/
// theme.css is where the palette and the roles are defined.
const SKIPPED =
    /\.test\.tsx?$|(?:^|\/)(?:__tests__|type-tests|fixtures)\/|components\/theme\.css$/

// prettier-ignore
const NAMED = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.replaceAll(' ', '|');
const TAILWIND_HUES =
    'slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

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
    ['@dhis2/ui colour variable', /var\(--colors-/],
    [
        'colour function',
        /\b(?:hsla?|hwb|lab|lch|oklab|oklch)\(|\bcolor\((?:srgb|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|from)\b/,
    ],
    [
        'Tailwind palette utility',
        new RegExp(
            `\\b(?:bg|text|border(?:-[trblxyse])?|outline|fill|stroke|ring-offset|ring|from|to|via|divide|placeholder|decoration|accent|caret|shadow)-(?:${TAILWIND_HUES})-\\d{2,3}\\b`
        ),
    ],
    [
        'named colour',
        new RegExp(
            // quoted alone, a Tailwind arbitrary value, or inside a colour declaration
            `['"\`](?:${NAMED})['"\`]|\\[(?:${NAMED})\\]|(?:color|background|fill|stroke|border|outline|shadow|decoration)[\\w-]*\\s*:[^;]*\\b(?:${NAMED})\\b`,
            'i'
        ),
    ],
]
const EXEMPTION = 'colour-literal:'

const TOKEN_USE =
    /\b(?:bg|text|border(?:-[trblxyse])?|outline|fill|stroke|ring-offset|inset-ring|ring|caret|from|to|via|divide|placeholder|decoration|accent|drop-shadow|text-shadow|shadow)-dhis2-([a-z][a-z0-9-]*?)(?![a-z0-9-])/g
const VARIABLE_USE = /\(--dhis2-([a-z][a-z0-9-]*)\)/g

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

// Playground canvases are shown to readers as code (`?canvas`), like the examples.
const CANVAS = /(?<!Lab)Canvas\.tsx$|LabFinder\.tsx$/

const files = [
    ...ROOTS.flatMap(listSources),
    ...listSources('apps/docs/src/playground').filter((path) =>
        CANVAS.test(path)
    ),
].sort()

const linesOf = (path: string): string[] =>
    readFileSync(join(REPO_ROOT, path), 'utf8').split('\n')

const rawColoursIn = (lines: string[]): string[] =>
    lines.flatMap((line, index) => {
        if (line.includes(EXEMPTION) || lines[index - 1]?.includes(EXEMPTION)) {
            return []
        }
        return RAW_COLOURS.filter(([, pattern]) => pattern.test(line)).map(
            ([label]) => `${index + 1} ${label}`
        )
    })

const rawColours = (path: string): string[] =>
    rawColoursIn(linesOf(path)).map((finding) => `${path}:${finding}`)

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

    it('scans stylesheets and docs pages too', () => {
        expect(files).toContain('apps/docs/src/pages/blocks/badge.mdx')
        expect(files).not.toContain('packages/registry/components/theme.css')
    })

    it.each([
        "style={{ color: 'rebeccapurple' }}",
        'stroke="navy"',
        'className="bg-[tomato]"',
        'border: 1px solid red;',
        'color: hsl(0 0% 20%);',
        "fill: 'oklch(0.5 0.1 200)'",
        'background: color(display-p3 1 0 0);',
        'className="text-red-500"',
        'className="text-[var(--colors-grey700)]"',
        'className="ring-offset-sky-200"',
    ])('flags %s', (line) => {
        expect(rawColoursIn([line])).not.toEqual([])
    })

    it.each([
        "style={{ color: 'inherit' }}",
        'className="forced-colors:border-[CanvasText]"',
        "const tone = 'warning'",
        'Mark the record as red-flagged in the notes',
        'className="bg-dhis2-neutral-muted text-dhis2-destructive"',
    ])('lets %s through', (line) => {
        expect(rawColoursIn([line])).toEqual([])
    })

    it.each(files)('%s uses only semantic colour tokens', (path) => {
        expect(rawColours(path)).toEqual([])
    })

    it.each(files)('%s names only defined tokens', (path) => {
        expect(unknownTokens(path)).toEqual([])
    })
})

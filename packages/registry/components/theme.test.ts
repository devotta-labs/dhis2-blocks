import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')

const CONTRAST_BLOCK =
    /@media \(prefers-contrast: more\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/

const declarations = (block: string): Map<string, string> =>
    new Map(
        [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
            match[1],
            match[2]
                .replace(/\s+/g, ' ')
                .replace(/\(\s+/g, '(')
                .replace(/\s+\)/g, ')')
                .trim(),
        ])
    )

const blockOf = (source: string, pattern: RegExp): string =>
    source.match(pattern)?.[1] ?? ''

const contrastLayer = declarations(blockOf(css, CONTRAST_BLOCK))
const defaultLayer = declarations(
    blockOf(css.replace(CONTRAST_BLOCK, ''), /:root\s*\{([^}]*)\}/)
)
const inlineLayer = declarations(blockOf(css, /@theme inline\s*\{([^}]*)\}/))
const palette = declarations(blockOf(css, /@theme\s*\{([^}]*)\}/))

const step = (name: string): string =>
    name === 'white'
        ? '#ffffff'
        : (palette.get(`color-dhis2-${name}`) ?? `no palette step ${name}`)

// The spec's token map: each role's palette step by default and with more contrast.
const SPEC = {
    background: ['white', 'white'],
    foreground: ['grey-900', 'grey-900'],
    card: ['white', 'white'],
    'card-foreground': ['grey-900', 'grey-900'],
    popover: ['white', 'white'],
    'popover-foreground': ['grey-900', 'grey-900'],
    'accent-foreground': ['grey-900', 'grey-900'],
    'muted-foreground': ['grey-700', 'grey-800'],
    'subtle-foreground': ['grey-600', 'grey-800'],
    'disabled-foreground': ['grey-600', 'grey-700'],
    border: ['grey-300', 'grey-600'],
    'border-strong': ['grey-400', 'grey-800'],
    input: ['grey-500', 'grey-800'],
    control: ['grey-800', 'grey-900'],
    ring: ['blue-600', 'blue-800'],
    muted: ['grey-100', 'grey-200'],
    accent: ['grey-200', 'grey-300'],
    'accent-strong': ['grey-300', 'grey-400'],
    primary: ['blue-700', 'blue-800'],
    'primary-strong': ['blue-800', 'blue-900'],
    'primary-subtle': ['blue-050', 'blue-050'],
    'primary-foreground': ['white', 'white'],
    selected: ['teal-100', 'teal-100'],
    'selected-strong': ['teal-500', 'teal-700'],
    'selected-foreground': ['teal-700', 'teal-800'],
    info: ['blue-900', 'blue-900'],
    'info-subtle': ['blue-050', 'blue-050'],
    'info-border': ['blue-200', 'blue-800'],
    warning: ['yellow-800', 'yellow-900'],
    'warning-subtle': ['yellow-050', 'yellow-050'],
    'warning-border': ['yellow-200', 'yellow-900'],
    destructive: ['red-700', 'red-800'],
    'destructive-subtle': ['red-050', 'red-050'],
    'destructive-border': ['red-500', 'red-800'],
    'destructive-foreground': ['white', 'white'],
    success: ['green-700', 'green-800'],
    'success-subtle': ['green-050', 'green-050'],
    'success-border': ['green-200', 'green-800'],
    'background-subtle': ['grey-050', 'grey-100'],
    neutral: ['grey-700', 'grey-800'],
    'neutral-subtle': ['grey-100', 'grey-100'],
    'neutral-fill': ['grey-200', 'grey-200'],
    'neutral-border': ['grey-300', 'grey-600'],
    'neutral-indicator': ['grey-600', 'grey-800'],
    'neutral-strong': ['grey-900', 'grey-900'],
    'info-fill': ['blue-100', 'blue-100'],
    'info-indicator': ['blue-600', 'blue-800'],
    'info-strong': ['blue-900', 'blue-900'],
    'success-fill': ['green-100', 'green-100'],
    'success-indicator': ['green-600', 'green-800'],
    'success-strong': ['green-900', 'green-900'],
    'warning-fill': ['yellow-100', 'yellow-100'],
    'warning-indicator': ['yellow-700', 'yellow-800'],
    'warning-strong': ['yellow-900', 'yellow-900'],
    'destructive-fill': ['red-100', 'red-100'],
    'destructive-indicator': ['red-600', 'red-800'],
    'destructive-strong': ['red-900', 'red-900'],
    sidebar: ['grey-900', 'grey-900'],
    'sidebar-foreground': ['grey-300', 'grey-050'],
    'sidebar-accent': ['grey-800', 'grey-800'],
    'sidebar-accent-foreground': ['grey-050', 'white'],
    'sidebar-border': ['grey-700', 'grey-500'],
    'sidebar-primary': ['teal-400', 'teal-200'],
    'sidebar-ring': ['grey-050', 'white'],
} satisfies Record<string, [string, string]>
// Not palette steps: the overlay is a translucent grey and the shadows are lists.
const NOT_IN_PALETTE = ['overlay', 'shadow-card', 'shadow-popover']

const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((start) => {
        const value = parseInt(hex.slice(start, start + 2), 16) / 255
        return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

const contrast = (first: string, second: string): number => {
    const [lighter, darker] = [luminance(first), luminance(second)].sort(
        (a, b) => b - a
    )
    return (lighter + 0.05) / (darker + 0.05)
}

const defaultValue = (role: string): string => {
    const value = defaultLayer.get(`dhis2-${role}`)
    if (value === undefined) throw new Error(`--dhis2-${role} is not defined`)
    return value
}

const contrastValue = (role: string): string =>
    contrastLayer.get(`dhis2-${role}`) ?? defaultValue(role)

describe('theme.css', () => {
    it('defines exactly the roles in the token map', () => {
        const roles = [...defaultLayer.keys()]
            .map((name) => name.slice('dhis2-'.length))
            .filter((role) => !NOT_IN_PALETTE.includes(role))
        expect(roles.toSorted()).toEqual(Object.keys(SPEC).toSorted())
    })

    it("overlays in @dhis2/ui's translucent grey, darker with more contrast", () => {
        expect([defaultValue('overlay'), contrastValue('overlay')]).toEqual([
            'rgb(33 43 54 / 0.4)',
            'rgb(33 43 54 / 0.6)',
        ])
    })

    it.each(Object.entries(SPEC))(
        '%s is %j by default and with more contrast',
        (role, [defaultStep, contrastStep]) => {
            expect([defaultValue(role), contrastValue(role)]).toEqual([
                step(defaultStep),
                step(contrastStep),
            ])
        }
    )

    it('every inline colour maps to a runtime variable', () => {
        const colours = [...inlineLayer].filter(([name]) =>
            name.startsWith('color-dhis2-')
        )
        expect(colours.length).toBeGreaterThan(0)
        for (const [name, value] of colours) {
            const role = name.slice('color-'.length)
            expect(value).toBe(`var(--${role})`)
            expect(defaultLayer.has(role)).toBe(true)
        }
    })

    it('the contrast layer only overrides defined variables', () => {
        expect(contrastLayer.size).toBeGreaterThan(0)
        for (const name of contrastLayer.keys()) {
            expect(defaultLayer.has(name)).toBe(true)
        }
    })

    it.each([
        ['foreground', 'background', 7],
        ['muted-foreground', 'background', 7],
        ['subtle-foreground', 'background', 4.5],
        ['primary', 'background', 4.5],
        ['destructive', 'background', 4.5],
        ['destructive', 'destructive-subtle', 4.5],
        ['info', 'info-subtle', 7],
        ['success', 'success-subtle', 4.5],
        ['ring', 'background', 3],
        ['selected-strong', 'background', 3],
        ['foreground', 'selected', 7],
        ['sidebar-foreground', 'sidebar', 7],
    ])(
        'default theme: %s on %s is at least %s:1',
        (foreground, background, floor) => {
            expect(
                contrast(defaultValue(foreground), defaultValue(background))
            ).toBeGreaterThanOrEqual(floor)
        }
    )

    it.each([
        ['foreground', 'background', 7],
        ['muted-foreground', 'background', 7],
        ['subtle-foreground', 'background', 7],
        ['disabled-foreground', 'background', 7],
        ['primary', 'background', 7],
        ['destructive', 'background', 7],
        ['destructive', 'destructive-subtle', 7],
        ['destructive-foreground', 'destructive', 7],
        ['warning', 'warning-subtle', 7],
        ['success', 'success-subtle', 7],
        ['info', 'info-subtle', 7],
        ['foreground', 'selected', 7],
        ['foreground', 'accent-strong', 7],
        ['sidebar-foreground', 'sidebar', 7],
        ['input', 'background', 4.5],
        ['control', 'background', 4.5],
        ['border-strong', 'background', 4.5],
        ['ring', 'background', 4.5],
        ['selected-strong', 'background', 4.5],
        ['selected-foreground', 'background', 4.5],
        ['sidebar-border', 'sidebar', 4.5],
        ['sidebar-primary', 'sidebar-accent', 4.5],
        ['border', 'background', 3],
    ])(
        'high-contrast theme: %s on %s is at least %s:1',
        (foreground, background, floor) => {
            expect(
                contrast(contrastValue(foreground), contrastValue(background))
            ).toBeGreaterThanOrEqual(floor)
        }
    )

    const TONES = ['neutral', 'info', 'success', 'warning', 'destructive']
    type Floor = [foreground: string, background: string, floor: number]

    it.each(TONES)('gives %s every step of the tone scale', (tone) => {
        const steps = [
            '',
            '-subtle',
            '-fill',
            '-border',
            '-indicator',
            '-strong',
        ]
        const missing = steps
            .map((step) => `dhis2-${tone}${step}`)
            .filter((name) => !defaultLayer.has(name))
        expect(missing).toEqual([])
    })

    it.each([
        ...TONES.map((tone): Floor => [`${tone}-indicator`, 'background', 3]),
        ...TONES.map((tone): Floor => [`${tone}-strong`, `${tone}-fill`, 7]),
        ...TONES.map((tone): Floor => [tone, `${tone}-subtle`, 4.5]),
        ['warning', 'warning-subtle', 4.5],
        ['muted-foreground', 'background-subtle', 7],
    ] satisfies Floor[])(
        'default theme: %s on %s is at least %s:1',
        (foreground, background, floor) => {
            expect(
                contrast(defaultValue(foreground), defaultValue(background))
            ).toBeGreaterThanOrEqual(floor)
        }
    )

    it.each([
        ...TONES.map((tone): Floor => [`${tone}-indicator`, 'background', 4.5]),
        ...TONES.map((tone): Floor => [`${tone}-strong`, `${tone}-fill`, 7]),
        ...TONES.map((tone): Floor => [tone, `${tone}-subtle`, 4.5]),
    ] satisfies Floor[])(
        'high-contrast theme: %s on %s is at least %s:1',
        (foreground, background, floor) => {
            expect(
                contrast(contrastValue(foreground), contrastValue(background))
            ).toBeGreaterThanOrEqual(floor)
        }
    )
})

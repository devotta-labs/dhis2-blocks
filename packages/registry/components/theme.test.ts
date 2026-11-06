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

    it.each([
        ...TONES.map((tone): Floor => [`${tone}-indicator`, 'background', 3]),
        ...TONES.map((tone): Floor => [`${tone}-strong`, `${tone}-muted`, 7]),
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
        ...TONES.map((tone): Floor => [`${tone}-strong`, `${tone}-muted`, 7]),
    ] satisfies Floor[])(
        'high-contrast theme: %s on %s is at least %s:1',
        (foreground, background, floor) => {
            expect(
                contrast(contrastValue(foreground), contrastValue(background))
            ).toBeGreaterThanOrEqual(floor)
        }
    )
})

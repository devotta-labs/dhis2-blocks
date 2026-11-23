const MASK_RANGES = new Map([
    ['d', '0-9'],
    ['x', 'a-z'],
    ['X', 'A-Z'],
    ['w', '0-9a-zA-Z'],
])

const masks = new Map<string, RegExp | undefined>()

const compile = (raw: string) => {
    const mask =
        raw.length > 1 && raw.startsWith("'") && raw.endsWith("'")
            ? raw.slice(1, -1)
            : raw
    if (mask.trim() === '') {
        return undefined
    }
    let inClass = false
    const source = mask.replace(
        /\\([\s\S])|[[\]]/g,
        (match: string, escaped: string | undefined) => {
            if (escaped === undefined) {
                inClass = match === '['
                return match
            }
            const range = MASK_RANGES.get(escaped)
            if (range === undefined) {
                return match
            }
            return inClass ? range : `[${range}]`
        }
    )
    try {
        return new RegExp(`^(?:${source})$`)
    } catch {
        return undefined
    }
}

/** Whether the value matches the whole mask; a missing or unusable mask matches. */
export const matchesFieldMask = (mask: string, value: string) => {
    if (!masks.has(mask)) {
        masks.set(mask, compile(mask))
    }
    return masks.get(mask)?.test(value) ?? true
}

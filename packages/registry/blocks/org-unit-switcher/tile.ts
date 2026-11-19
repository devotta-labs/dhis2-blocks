/**
 * Theme role pairs made for a chip and its text, so the initial stays AA in
 * every theme. The contrast test reads this list.
 */
export const TILE_CLASSES = [
    'bg-dhis2-primary text-dhis2-primary-foreground',
    'bg-dhis2-info-fill text-dhis2-info-strong',
    'bg-dhis2-success-fill text-dhis2-success-strong',
    'bg-dhis2-warning-fill text-dhis2-warning-strong',
    'bg-dhis2-selected text-dhis2-selected-foreground',
    'bg-dhis2-neutral-fill text-dhis2-neutral-strong',
] as const

export const tileInitial = (displayName: string): string => {
    const [first] = displayName.trim()
    return first === undefined ? '?' : first.toLocaleUpperCase()
}

/** The same id always gets the same colour, on every device. */
export const tileClass = (id: string): string => {
    let hash = 0
    for (const char of id) {
        hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
    }
    return TILE_CLASSES[hash % TILE_CLASSES.length] ?? TILE_CLASSES[0]
}

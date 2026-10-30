const DAY_MS = 86_400_000

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** Local calendar day: DHIS2 timestamps carry no offset, so they parse as local time. */
export const isoDay = (date: Date): string =>
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const midnight = (date: Date): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** Whole local calendar days from `from` to `to`; undefined when either is missing. */
export function dayDifference(
    from: Date | undefined,
    to: Date | undefined
): number | undefined {
    if (!from || !to) return undefined
    // Rounded: a daylight-saving day is 23 or 25 hours long.
    return Math.round((midnight(to) - midnight(from)) / DAY_MS)
}

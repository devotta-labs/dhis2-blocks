import { z } from 'zod'

export interface Remembered {
    current?: string
    recent: string[]
}

export const MAX_RECENT = 5

const RememberedSchema = z.object({
    current: z.string().optional(),
    recent: z.array(z.string()),
})

const keyOf = (userId: string) => `dhis2-blocks:org-unit-switcher:${userId}`

/** Storage can be blocked or full, and the choice is only a convenience, so neither call throws. */
export const readRemembered: (userId: string) => Remembered = (userId) => {
    try {
        const raw = localStorage.getItem(keyOf(userId))
        const parsed = RememberedSchema.safeParse(
            raw === null ? undefined : JSON.parse(raw)
        )
        return parsed.success ? parsed.data : { recent: [] }
    } catch {
        return { recent: [] }
    }
}

export const writeRemembered = (userId: string, value: Remembered) => {
    try {
        localStorage.setItem(keyOf(userId), JSON.stringify(value))
    } catch {}
}

/** id to the front, deduped, capped at MAX_RECENT */
export const withRecent = (recent: string[], id: string) =>
    [id, ...recent.filter((r) => r !== id)].slice(0, MAX_RECENT)

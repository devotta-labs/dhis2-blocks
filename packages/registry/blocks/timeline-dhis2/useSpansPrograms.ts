import { useMemo } from 'react'
import { useOptionalTimeline } from '@/components/timeline/ui/TimelineContext'
import type { HistoryEntryData } from './types'

const programOf = (data: HistoryEntryData): string | undefined => {
    switch (data.kind) {
        case 'event':
            return data.event.program
        case 'milestone':
        case 'note':
            return data.enrollment.program
        case 'change':
            return undefined
    }
}

/**
 * Whether the surrounding feed holds entries from more than one program, so
 * naming the program tells the entries apart. Outside a feed, always true.
 */
export const useSpansPrograms = (): boolean => {
    const timeline = useOptionalTimeline()
    const entries = timeline?.state.entries
    return useMemo(() => {
        if (entries === undefined) {
            return true
        }
        const programs = new Set<string>()
        for (const entry of entries) {
            // SAFETY: the DHIS2 entry parts render inside a feed of history entries; a host's own kind matches no case and names no program.
            const program = programOf(entry.data as HistoryEntryData)
            if (program !== undefined) {
                programs.add(program)
            }
        }
        return programs.size > 1
    }, [entries])
}

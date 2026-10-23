import { Result } from 'better-result'
import { staticTimelineSource } from './staticTimelineSource'
import type { TimelineEntry } from './types'

describe('staticTimelineSource', () => {
    it('returns every entry in one complete page', async () => {
        const entries: TimelineEntry<string>[] = [
            { id: '1', at: '2026-10-01', sourceKey: 'notes', data: 'one' },
            { id: '2', at: '2026-09-01', sourceKey: 'notes', data: 'two' },
        ]
        const source = staticTimelineSource('notes', 'Notes', entries)
        expect(source.key).toBe('notes')
        expect(source.label).toBe('Notes')

        const result = await source.fetchPage(
            undefined,
            new AbortController().signal
        )
        if (!Result.isOk(result)) {
            throw new Error('expected a page')
        }
        expect(result.value.entries).toEqual(entries)
        expect(result.value.nextCursor).toBeUndefined()
    })

    it('carries the revision and subject it is given', () => {
        const source = staticTimelineSource('notes', 'Notes', [], {
            revision: 3,
            subject: 'te1',
        })
        expect(source.revision).toBe(3)
        expect(source.subject).toBe('te1')
    })
})

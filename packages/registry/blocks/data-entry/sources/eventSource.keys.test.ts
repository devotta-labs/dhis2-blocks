import { eventSource } from './eventSource'

test('the key names the program: its grids share one record per cell', () => {
    expect(eventSource({ programId: 'p', orgUnitId: 'o' }).key).toBe('events:p')
    expect(
        eventSource({
            programId: 'p',
            programStageId: 's',
            orgUnitId: 'o2',
            orgUnitMode: 'DESCENDANTS',
            enrollmentId: 'e',
        }).key
    ).toBe('events:p')
})

test('the cache key adds what else the load reads; the outbox key stays the same', () => {
    const first = eventSource({ programId: 'p', orgUnitId: 'o' })
    const bigger = eventSource({
        programId: 'p',
        orgUnitId: 'o',
        pageSize: 100,
    })
    const oldest = eventSource({
        programId: 'p',
        orgUnitId: 'o',
        order: 'occurredAt:asc',
    })
    const adding = eventSource({
        programId: 'p',
        orgUnitId: 'o',
        enrollmentId: 'e',
        newRowStageId: 's',
        today: '2026-10-26',
    })
    expect(first.cacheKey).toBe(
        'events:p:-:o:SELECTED:-:50:occurredAt:desc:-:-'
    )
    expect(bigger.cacheKey).toBe(
        'events:p:-:o:SELECTED:-:100:occurredAt:desc:-:-'
    )
    expect(oldest.cacheKey).toBe(
        'events:p:-:o:SELECTED:-:50:occurredAt:asc:-:-'
    )
    expect(adding.cacheKey).toBe(
        'events:p:-:o:SELECTED:e:50:occurredAt:desc:s:2026-10-26'
    )
    expect(new Set([first.key, bigger.key, oldest.key, adding.key]).size).toBe(
        1
    )
})

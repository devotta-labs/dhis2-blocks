import { describe, expect, it } from 'vitest'
import { generateWorld, type LabConfig } from './labData'
import { answer } from './labServer'
import { DEFAULT_CONFIG } from './presets'

const TODAY = '2026-11-02'

const config = (changes: {
    data?: Partial<LabConfig['data']>
    server?: Partial<LabConfig['server']>
}): LabConfig => ({
    data: { ...DEFAULT_CONFIG.data, ...changes.data },
    server: { ...DEFAULT_CONFIG.server, ...changes.server },
    network: DEFAULT_CONFIG.network,
    view: DEFAULT_CONFIG.view,
})

const enrolledIn = async (lab: LabConfig, after: string, before: string) => {
    const response = await answer(lab, generateWorld(lab.data, TODAY), {
        resource: 'tracker/trackedEntities',
        params: {
            page: 1,
            pageSize: 500,
            enrollmentEnrolledAfter: after,
            enrollmentEnrolledBefore: before,
        },
    })
    if (!('trackedEntities' in response)) throw new Error('No people')
    return response.trackedEntities.map(
        (person) => person.enrollments?.[0]?.enrolledAt
    )
}

describe('the calendar lab server', () => {
    it('spreads records evenly around today', () => {
        const world = generateWorld(
            config({ data: { records: 3, spanDays: 10 } }).data,
            TODAY
        )
        expect(world.people.map((person) => person.enrolledAt)).toEqual([
            '2026-10-23T00:00:00.000',
            '2026-11-02T00:00:00.000',
            '2026-11-12T00:00:00.000',
        ])
    })

    it('answers only records inside the requested window', async () => {
        const dates = await enrolledIn(
            config({ data: { records: 61, spanDays: 30 } }),
            '2026-11-01',
            '2026-11-30'
        )
        expect(dates).toHaveLength(30)
        expect(
            dates.every((date) => {
                const day = date?.slice(0, 10) ?? ''
                return day >= '2026-11-01' && day <= '2026-11-30'
            })
        ).toBe(true)
    })

    it('can ignore the window, as a misbehaving server would', async () => {
        const dates = await enrolledIn(
            config({
                data: { records: 61, spanDays: 30 },
                server: { records: 'ignoresWindow' },
            }),
            '2026-11-01',
            '2026-11-30'
        )
        expect(dates).toHaveLength(61)
    })

    it('leaves records without a date out of a dated window', async () => {
        const lab = config({ data: { records: 100, missingDates: 100 } })
        expect(await enrolledIn(lab, '2026-01-01', '2026-12-31')).toEqual([])
    })

    it('links a next page only from DHIS2 2.42', async () => {
        const request = {
            resource: 'tracker/trackedEntities',
            params: { page: 1, pageSize: 10 },
        }
        const pager = async (apiVersion: number) => {
            const lab = config({ server: { apiVersion } })
            const response = await answer(
                lab,
                generateWorld(lab.data, TODAY),
                request
            )
            return 'pager' in response ? response.pager : undefined
        }
        expect(await pager(42)).toMatchObject({ nextPage: 'next' })
        expect(await pager(41)).not.toHaveProperty('nextPage')
    })
})

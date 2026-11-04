import {
    ProgramResponseSchema,
    TrackedEntitiesResponseSchema,
} from '@/components/tracked-entity-finder/api/schemas'
import { describe, expect, it } from 'vitest'
import { LAB_PROGRAM } from '../labData'
import { answer } from '../labServer'
import { DEFAULT_SETTINGS, PRESETS } from '../presets'

const search = (
    settings = DEFAULT_SETTINGS,
    params: Record<string, number> = {}
) =>
    TrackedEntitiesResponseSchema.parse(
        answer(settings)({ resource: 'tracker/trackedEntities', params })
    )

const statusOf = (run: () => object) => {
    try {
        run()
    } catch (error) {
        // SAFETY: the lab throws app-runtime shaped errors.
        return (error as { details: { httpStatusCode: number } }).details
            .httpStatusCode
    }
    return undefined
}

describe('the finder lab server', () => {
    it('answers every preset’s program in the shape the finder parses', () => {
        for (const { settings } of PRESETS) {
            expect(() =>
                ProgramResponseSchema.parse(
                    answer(settings)({ resource: 'programs', id: LAB_PROGRAM })
                )
            ).not.toThrow()
        }
    })

    it('has no program but its own', () => {
        expect(
            statusOf(() =>
                answer(DEFAULT_SETTINGS)({ resource: 'programs', id: 'other' })
            )
        ).toBe(404)
    })

    it('answers the calendar it is set to', () => {
        expect(
            answer({
                ...DEFAULT_SETTINGS,
                server: { ...DEFAULT_SETTINGS.server, calendar: 'nepali' },
            })({ resource: 'system/info' })
        ).toEqual({
            calendar: 'nepali',
            dateFormat: 'YYYY-MM-DD',
            version: '2.43.1',
        })
    })

    it('pages the matches, with a total', () => {
        const settings = {
            ...DEFAULT_SETTINGS,
            server: { ...DEFAULT_SETTINGS.server, matches: 23 },
        }
        const last = search(settings, { page: 3, pageSize: 10 })
        expect(last.trackedEntities).toHaveLength(3)
        expect(last.pager?.total).toBe(23)
    })

    it('gives each person a value for every attribute', () => {
        const person = search().trackedEntities?.[0]
        expect(person?.attributes.map(({ attribute }) => attribute)).toEqual(
            DEFAULT_SETTINGS.program.attributes.map(({ id }) => id)
        )
    })
})

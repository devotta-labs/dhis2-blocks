import {
    EnrollmentsResponseSchema,
    EventsResponseSchema,
    ProgramMetadataResponseSchema,
} from '@/components/observation-cards/api/schemas'
import { describe, expect, it } from 'vitest'
import { generateLabData, LAB_PERSON, LAB_PROGRAM } from './labData'
import { answer } from './labServer'
import { DEFAULT_SETTINGS, PRESETS } from './presets'

const TODAY = '2026-11-02'

const settingsOf = (name: string) => {
    const found = PRESETS.find((preset) => preset.name === name)
    if (!found) throw new Error(`No preset ${name}`)
    return found.settings
}

const subject = { trackedEntity: LAB_PERSON, program: LAB_PROGRAM }

const eventsPage = (
    settings = DEFAULT_SETTINGS,
    params: Record<string, number> = {}
) =>
    EventsResponseSchema.parse(
        answer(
            settings,
            generateLabData(settings, TODAY)
        )({
            resource: 'tracker/events',
            params: { ...subject, page: 1, pageSize: 200, ...params },
        })
    )

describe('the observations lab server', () => {
    it('answers the program metadata in the shape the block parses', () => {
        const metadata = ProgramMetadataResponseSchema.parse(
            answer(DEFAULT_SETTINGS)({ resource: 'programs', id: LAB_PROGRAM })
        )
        expect(metadata.stages.length).toBeGreaterThan(0)
        expect(metadata.dataElements.size).toBeGreaterThan(0)
    })

    it('answers the enrollments in the shape the block parses, honouring pageSize', () => {
        const settings = { ...DEFAULT_SETTINGS, enrollments: 3 }
        const respond = answer(settings)
        const all = EnrollmentsResponseSchema.parse(
            respond({
                resource: 'tracker/enrollments',
                params: { ...subject, pageSize: 50 },
            })
        )
        const first = EnrollmentsResponseSchema.parse(
            respond({
                resource: 'tracker/enrollments',
                params: { ...subject, pageSize: 1 },
            })
        )
        expect(all).toHaveLength(3)
        expect(first).toHaveLength(1)
    })

    it('answers events in the shape the block parses', () => {
        expect(eventsPage().length).toBeGreaterThan(0)
    })

    it('pages events by page and pageSize', () => {
        const settings = settingsOf('500 readings')
        const pages = [1, 2, 3].map((page) => eventsPage(settings, { page }))
        expect(pages.map((events) => events.length)).toEqual([200, 200, 100])
        const ids = pages.flat().map(({ event }) => event)
        expect(new Set(ids).size).toBe(500)
        expect(eventsPage(settings, { page: 2, pageSize: 7 })).toHaveLength(7)
    })

    it('marks a stage unreadable and leaves its events out for Partial access', () => {
        const settings = settingsOf('Partial access')
        const metadata = ProgramMetadataResponseSchema.parse(
            answer(settings)({ resource: 'programs', id: LAB_PROGRAM })
        )
        const hidden = metadata.stages.filter((stage) => !stage.canReadData)
        expect(hidden).toHaveLength(1)
        const hiddenIds = new Set(hidden.map(({ id }) => id))
        expect(
            eventsPage(settings).some(({ programStage }) =>
                hiddenIds.has(programStage)
            )
        ).toBe(false)
    })

    it('sets the system calendar for Ethiopian calendar', () => {
        expect(
            generateLabData(settingsOf('Ethiopian calendar'), TODAY).systemInfo
                .calendar
        ).toBe('ethiopian')
    })

    it('generates the same data for the same settings', () => {
        expect(generateLabData(settingsOf('Jumpy RMNCH-like'), TODAY)).toEqual(
            generateLabData(settingsOf('Jumpy RMNCH-like'), TODAY)
        )
    })

    it('mixes in scheduled and skipped events when asked', () => {
        const statuses = new Set(
            eventsPage({ ...DEFAULT_SETTINGS, scheduledSkipped: true }).map(
                ({ status }) => status
            )
        )
        expect(statuses).toEqual(
            new Set(['ACTIVE', 'COMPLETED', 'SCHEDULE', 'SKIPPED'])
        )
    })

    it('answers nothing for another person', () => {
        expect(
            EventsResponseSchema.parse(
                answer(DEFAULT_SETTINGS)({
                    resource: 'tracker/events',
                    params: { ...subject, trackedEntity: 'someoneElse' },
                })
            )
        ).toEqual([])
    })
})

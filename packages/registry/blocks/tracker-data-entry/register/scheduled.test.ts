import { describe, expect, test } from 'vitest'
import rmnch from './__tests__/fixtures/rmnch-register-program.json'
import { registerMetadataOf, registerProgramSchema } from './metadata'
import type { RegisterMetadata, RegisterStage } from './metadata'
import { scheduledEventsFor } from './scheduled'

const BASE = registerMetadataOf(registerProgramSchema.parse(rmnch))
const stage = (changes: Partial<RegisterStage>): RegisterStage => ({
    name: 'Postnatal',
    repeatable: false,
    validationStrategy: 'ON_UPDATE_AND_INSERT',
    dataElements: new Map(),
    autoGenerateEvent: true,
    minDaysFromStart: 0,
    generatedByEnrollmentDate: false,
    openAfterEnrollment: false,
    ...changes,
})
const metadataOf = (...stages: RegisterStage[]): RegisterMetadata => ({
    ...BASE,
    stages: new Map(stages.map((s, i) => [`S${i}`, s])),
})

describe('scheduledEventsFor', () => {
    test('dates as Capture dates them', () => {
        const metadata = metadataOf(
            stage({ minDaysFromStart: 28, reportDateToUse: 'enrollmentDate' }),
            stage({ minDaysFromStart: 3, generatedByEnrollmentDate: true }),
            stage({ minDaysFromStart: 1 })
        )
        expect(
            scheduledEventsFor(metadata, {
                enrolledAt: '2026-02-10',
                occurredAt: '2026-01-20',
            })
        ).toEqual([
            // From the incident date, which the dates carry as `occurredAt`.
            {
                stageId: 'S0',
                scheduledAt: '2026-02-17',
                occurredAt: '2026-02-10',
            },
            { stageId: 'S1', scheduledAt: '2026-02-13' },
            { stageId: 'S2', scheduledAt: '2026-01-21' },
        ])
    })

    test('the incident date dates a stage that asks for it; a missing one falls back to enrolment', () => {
        const metadata = metadataOf(stage({ reportDateToUse: 'incidentDate' }))
        expect(
            scheduledEventsFor(metadata, {
                enrolledAt: '2026-02-10',
                occurredAt: '2026-01-20',
            })
        ).toEqual([
            {
                stageId: 'S0',
                scheduledAt: '2026-01-20',
                occurredAt: '2026-01-20',
            },
        ])
        expect(
            scheduledEventsFor(metadata, { enrolledAt: '2026-02-10' })
        ).toEqual([{ stageId: 'S0', scheduledAt: '2026-02-10' }])
    })

    test('days are added in the calendar across a month end', () => {
        const metadata = metadataOf(stage({ minDaysFromStart: 28 }))
        expect(
            scheduledEventsFor(metadata, { enrolledAt: '2026-02-10' })[0]
                ?.scheduledAt
        ).toBe('2026-03-10')
        expect(
            scheduledEventsFor(
                metadata,
                { enrolledAt: '2026-02-10' },
                'ethiopian'
            )[0]?.scheduledAt
        ).toBe('2026-03-10')
    })

    test('openAfterEnrollment adds no days', () => {
        const metadata = metadataOf(
            stage({ minDaysFromStart: 28, openAfterEnrollment: true })
        )
        expect(
            scheduledEventsFor(metadata, { enrolledAt: '2026-02-10' })
        ).toEqual([{ stageId: 'S0', scheduledAt: '2026-02-10' }])
    })

    test('no autoGenerateEvent, no event', () => {
        const metadata = metadataOf(stage({ autoGenerateEvent: false }))
        expect(
            scheduledEventsFor(metadata, { enrolledAt: '2026-02-10' })
        ).toEqual([])
    })
})

import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import type { TimelineSource } from '../core/types'
import { useTimelineSources } from '../core/useTimelineSources'
import trackedEntity from './__fixtures__/v43/tracked-entity.json'
import { timelineKeys } from './timelineKeys'
import {
    type MilestoneEntryData,
    type NoteEntryData,
    useEnrollmentMilestonesSource,
    useEnrollmentNotesSource,
} from './useEnrollmentSources'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const subject = { trackedEntity: 'TlE2eTei001', program: 'WSGAb5XwJ3Y' }

/** What the server sends: a plain JSON object. */
type Response = object

const setup = (respond: () => Response) => {
    const queryClient = new QueryClient()
    const requests: unknown[] = []
    const data: CustomData = {
        'tracker/trackedEntities': async (_type, query) => {
            requests.push(query)
            // The engine takes JSON, as a real response is.
            return JSON.parse(JSON.stringify(respond()))
        },
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { requests, wrapper, queryClient }
}

const renderBoth = (wrapper: ReturnType<typeof setup>['wrapper']) =>
    renderHook(
        () => ({
            milestones: useEnrollmentMilestonesSource(subject),
            notes: useEnrollmentNotesSource(subject),
        }),
        { wrapper }
    )

const signal = () => new AbortController().signal

const entriesOf = async (source: TimelineSource) => {
    const result = await source.fetchPage(undefined, signal())
    if (Result.isError(result)) throw new Error(JSON.stringify(result.error))
    return result.value.entries
}

interface RawEnrollment {
    enrollment: string
    program: string
    status: string
    enrolledAt?: string
    occurredAt?: string
    completedAt?: string
    updatedAt?: string
    notes?: Array<{ note: string; value: string; storedAt?: string }>
}

const enrollment = (overrides: Partial<RawEnrollment>): RawEnrollment => ({
    enrollment: 'e1',
    program: 'WSGAb5XwJ3Y',
    status: 'ACTIVE',
    enrolledAt: '2026-01-10T00:00:00.000',
    ...overrides,
})

const entity = (...enrollments: RawEnrollment[]) => ({
    trackedEntity: 'TlE2eTei001',
    enrollments,
})

describe('enrollment sources', () => {
    it('emits enrolled, incident and completed milestones for a completed enrollment', async () => {
        const { wrapper } = setup(() => trackedEntity)
        const { result } = await renderBoth(wrapper)

        const entries = await entriesOf(result.current.milestones)

        expect(result.current.milestones.key).toBe('milestones')
        expect(
            entries
                .filter((e) => e.id.startsWith('milestones:TlE2eEnr001'))
                .map((e) => [e.id, e.at])
        ).toEqual([
            ['milestones:TlE2eEnr001:enrolled', '2024-03-01T00:00:00.000'],
            ['milestones:TlE2eEnr001:incident', '2024-02-10T00:00:00.000'],
            ['milestones:TlE2eEnr001:completed', '2024-11-20T09:15:00.000'],
        ])
    })

    it('omits the incident milestone when it equals the enrollment date', async () => {
        const { wrapper } = setup(() =>
            entity(
                enrollment({
                    occurredAt: '2026-01-10T00:00:00.000',
                })
            )
        )
        const { result } = await renderBoth(wrapper)

        const entries = await entriesOf(result.current.milestones)

        expect(entries.map((e) => e.id)).toEqual(['milestones:e1:enrolled'])
    })

    it('places a cancelled enrollment at completedAt, else updatedAt', async () => {
        const { wrapper } = setup(() =>
            entity(
                enrollment({
                    enrollment: 'a',
                    status: 'CANCELLED',
                    updatedAt: '2026-03-01T10:00:00.000',
                }),
                enrollment({
                    enrollment: 'b',
                    status: 'CANCELLED',
                    completedAt: '2026-04-01T10:00:00.000',
                    updatedAt: '2026-05-01T10:00:00.000',
                })
            )
        )
        const { result } = await renderBoth(wrapper)

        const entries = await entriesOf(result.current.milestones)

        expect(
            entries
                .filter((e) => e.id.endsWith(':cancelled'))
                .map((e) => [e.id, e.at])
        ).toEqual([
            ['milestones:a:cancelled', '2026-03-01T10:00:00.000'],
            ['milestones:b:cancelled', '2026-04-01T10:00:00.000'],
        ])
    })

    it('emits milestones and notes for every enrollment in the program', async () => {
        const { wrapper } = setup(() => trackedEntity)
        const { result } = await renderBoth(wrapper)

        const milestones = await entriesOf(result.current.milestones)
        const notes = await entriesOf(result.current.notes)

        expect(result.current.notes.key).toBe('notes')
        expect(
            milestones
                .filter((e) => e.id.endsWith(':enrolled'))
                .map((e) => e.id)
        ).toEqual(
            expect.arrayContaining([
                'milestones:TlE2eEnr001:enrolled',
                'milestones:TlE2eEnr002:enrolled',
            ])
        )
        expect(notes.map((e) => e.id).sort()).toEqual([
            'notes:TlE2eNot001',
            'notes:TlE2eNot002',
        ])
        expect(notes.every((e) => e.at.startsWith('2026-10-22'))).toBe(true)
    })

    it('makes one request for both sources', async () => {
        const { wrapper, requests } = setup(() => trackedEntity)
        const { result } = await renderBoth(wrapper)

        await entriesOf(result.current.milestones)
        await entriesOf(result.current.notes)

        expect(requests).toHaveLength(1)
    })

    it('reports a failed source with the server message when the tracked entity is not readable', async () => {
        const { wrapper } = setup(() => {
            throw new Error('Access denied to TlE2eTei001')
        })
        const { result } = await renderBoth(wrapper)

        const sources: TimelineSource[] = [
            result.current.milestones,
            result.current.notes,
        ]
        for (const source of sources) {
            const answer = await source.fetchPage(undefined, signal())
            expect(Result.isError(answer)).toBe(true)
            if (Result.isError(answer)) {
                expect(answer.error.kind).toBe('failed')
                expect(
                    answer.error.kind === 'failed' && answer.error.error.message
                ).toContain('Access denied to TlE2eTei001')
            }
        }
    })

    it('works for a tracked entity type that is not a person', async () => {
        const { wrapper } = setup(() => ({
            trackedEntity: 'TlE2eTei001',
            trackedEntityType: 'AnimalType',
            enrollments: [
                enrollment({
                    notes: [
                        {
                            note: 'n1',
                            value: 'Vaccinated',
                            storedAt: '2026-02-02T08:00:00.000',
                        },
                    ],
                }),
            ],
        }))
        const { result } = await renderBoth(wrapper)

        expect(
            (await entriesOf(result.current.milestones)).map((e) => e.id)
        ).toEqual(['milestones:e1:enrolled'])
        expect(
            (await entriesOf(result.current.notes)).map((e) => e.id)
        ).toEqual(['notes:n1'])
    })

    it('keeps the revision through the first load and changes it on invalidation', async () => {
        const { wrapper, queryClient } = setup(() => trackedEntity)
        const { result } = await renderBoth(wrapper)
        const before = result.current.milestones.revision

        await entriesOf(result.current.milestones)
        await expect
            .poll(
                () =>
                    queryClient.getQueryState(
                        timelineKeys.trackedEntity(
                            subject.trackedEntity,
                            subject.program
                        )
                    )?.status
            )
            .toBe('success')

        expect(result.current.milestones.revision).toBe(before)
        expect(result.current.notes.revision).toBe(before)

        await queryClient.invalidateQueries({ queryKey: timelineKeys.root })

        await expect
            .poll(() => result.current.milestones.revision)
            .not.toBe(before)
        expect(result.current.notes.revision).toBe(
            result.current.milestones.revision
        )
    })

    it('restarts after a failed first load once an invalidation succeeds', async () => {
        let fail = true
        const { wrapper, queryClient } = setup(() => {
            if (fail) throw new Error('Access denied to TlE2eTei001')
            return trackedEntity
        })
        const { result } = await renderBoth(wrapper)
        const failedAnswer = await result.current.milestones.fetchPage(
            undefined,
            signal()
        )
        expect(Result.isError(failedAnswer)).toBe(true)
        const before = result.current.milestones.revision

        fail = false
        await queryClient.invalidateQueries({ queryKey: timelineKeys.root })

        await expect
            .poll(() => result.current.milestones.revision)
            .not.toBe(before)
        expect(
            (await entriesOf(result.current.milestones)).length
        ).toBeGreaterThan(0)
    })

    it('keeps an incident on the same day at a different time', async () => {
        const { wrapper } = setup(() =>
            entity(
                enrollment({
                    enrolledAt: '2026-01-10T00:00:00.000',
                    occurredAt: '2026-01-10T15:30:00.000',
                })
            )
        )
        const { result } = await renderBoth(wrapper)

        const entries = await entriesOf(result.current.milestones)

        expect(entries.map((e) => e.id)).toEqual([
            'milestones:e1:enrolled',
            'milestones:e1:incident',
        ])
    })

    it('places a completed enrollment at updatedAt when it has no completedAt', async () => {
        const { wrapper } = setup(() =>
            entity(
                enrollment({
                    status: 'COMPLETED',
                    updatedAt: '2026-06-01T08:00:00.000',
                })
            )
        )
        const { result } = await renderBoth(wrapper)

        const entries = await entriesOf(result.current.milestones)

        expect(
            entries.filter((e) => e.id.endsWith(':completed')).map((e) => e.at)
        ).toEqual(['2026-06-01T08:00:00.000'])
    })

    it('emits no status milestone for an active enrollment', async () => {
        const { wrapper } = setup(() =>
            entity(
                enrollment({
                    status: 'ACTIVE',
                    completedAt: '2026-06-01T08:00:00.000',
                    updatedAt: '2026-06-02T08:00:00.000',
                })
            )
        )
        const { result } = await renderBoth(wrapper)

        const entries = await entriesOf(result.current.milestones)

        expect(entries.map((e) => e.id)).toEqual(['milestones:e1:enrolled'])
    })

    it('does not retry in a loop while the endpoint stays down', async () => {
        const { wrapper, requests } = setup(() => {
            throw new Error('Service unavailable')
        })
        const { result } = await renderHook(
            () =>
                useTimelineSources<MilestoneEntryData | NoteEntryData>([
                    useEnrollmentMilestonesSource(subject),
                    useEnrollmentNotesSource(subject),
                ]),
            { wrapper }
        )
        await expect
            .poll(() => result.current.sources.map((s) => s.status))
            .toEqual(['error', 'error'])

        result.current.retry('milestones')
        await new Promise((resolve) => setTimeout(resolve, 200))

        expect(requests.length).toBeLessThanOrEqual(2)
        expect(result.current.sources[0].status).toBe('error')
    })
})

import type { APIRequestContext } from '@playwright/test'
import { z } from 'zod'
import { expect } from '../fixtures/test'

// Response schemas and the tracker import helper for timeline.spec.ts.

export const SystemInfoSchema = z.object({ calendar: z.string() }).passthrough()

const EventSchema = z
    .object({ event: z.string(), updatedAt: z.string() })
    .passthrough()
// DHIS2 2.41 can answer with `instances`; later versions with `events`.
export const EventsSchema = z
    .object({
        events: z.array(EventSchema).optional(),
        instances: z.array(EventSchema).optional(),
    })
    .passthrough()
    .transform((page) => page.events ?? page.instances ?? [])

const ImportReportSchema = z.object({ status: z.string() }).passthrough()

export const NotesSchema = z
    .object({
        enrollments: z.array(
            z
                .object({
                    notes: z
                        .array(
                            z
                                .object({
                                    value: z.string(),
                                    storedAt: z.string(),
                                })
                                .passthrough()
                        )
                        .default([]),
                })
                .passthrough()
        ),
    })
    .passthrough()
    .transform((entity) => entity.enrollments.flatMap((e) => e.notes))

export const SeededEventsSchema = z
    .object({
        events: z.array(
            z.object({
                event: z.string(),
                program: z.string(),
                programStage: z.string(),
                enrollment: z.string(),
                trackedEntity: z.string(),
                orgUnit: z.string(),
                status: z.string(),
                occurredAt: z.string().optional(),
                scheduledAt: z.string(),
                dataValues: z
                    .array(
                        z.object({ dataElement: z.string(), value: z.string() })
                    )
                    .optional(),
            })
        ),
    })
    .passthrough()

/** The part of a tracker import payload these tests send. */
export interface TrackerImport {
    trackedEntities?: {
        trackedEntity: string
        trackedEntityType: string
        orgUnit: string
        attributes: { attribute: string; value: string }[]
    }[]
    events?: {
        event: string
        program: string
        programStage: string
        enrollment: string
        trackedEntity: string
        orgUnit: string
        status: string
        occurredAt?: string
        scheduledAt: string
        dataValues?: { dataElement: string; value: string }[]
    }[]
}

export const importTracker = async (
    api: APIRequestContext,
    payload: TrackerImport
) => {
    const response = await api.post('/api/tracker', {
        params: {
            async: 'false',
            importStrategy: 'UPDATE',
            atomicMode: 'ALL',
        },
        data: payload,
    })
    const body: unknown = await response.json()
    expect(response.ok(), JSON.stringify(body)).toBe(true)
    expect(ImportReportSchema.parse(body).status).toBe('OK')
}

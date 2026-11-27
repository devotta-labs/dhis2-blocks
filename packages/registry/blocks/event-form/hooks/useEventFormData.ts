import { useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { z } from 'zod'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { LocationOrgUnit } from '@/components/location-input'
import { geometrySchema } from '@/components/location-map'
import { limitedByOrgUnit } from '../lib/categories'
import {
    EVENT_FIELDS,
    heldEventSchema,
    PROGRAM_FIELDS,
    programSchema,
    settingsOf,
    stageFormOf,
    systemInfoSchema,
} from '../lib/metadata'
import type { HeldEvent, StageForm } from '../lib/metadata'

// Metadata and server settings change rarely; the rules' metadata is kept as long.
const HOUR = 60 * 60_000

export type EventFormData =
    | { status: 'loading' }
    | { status: 'error'; error: Error }
    | {
          status: 'ready'
          form: StageForm
          settings: ValueSettings
          held?: HeldEvent
          /** The form's org unit and its ancestors, when a category option is limited to org units; else empty. */
          orgUnits: ReadonlySet<string>
          /** The org unit's name and geometry, for a stage that records a location. */
          orgUnit?: LocationOrgUnit
          /** The user may set a completed event back to active (`F_UNCOMPLETE_EVENT`). */
          mayUncomplete: boolean
      }

const orgUnitSchema = z.object({
    path: z.string(),
    displayName: z.string().optional(),
    // A geometry the form cannot read is none: the location is then not checked against it.
    geometry: geometrySchema.optional().catch(undefined),
})
const meSchema = z.object({
    authorities: z.array(z.string()).default([]),
})
// `ALL` holds every authority.
const mayUncomplete = ({ authorities }: z.infer<typeof meSchema>) =>
    authorities.includes('ALL') || authorities.includes('F_UNCOMPLETE_EVENT')
const NO_ORG_UNITS: ReadonlySet<string> = new Set()

/**
 * The stage's form, the server's date settings, the user's authorities, when editing the event as DHIS2 holds it, and the org unit: its
 * ancestors when the program's category options need them, its name and geometry for a stage that records a location, in
 * one request.
 */
export const useEventFormData = (
    programId: string,
    programStageId: string,
    eventId: string | undefined,
    orgUnitId: string
): EventFormData => {
    const engine = useDataEngine()
    const program = useQuery({
        queryKey: ['event-form', 'program', programId],
        queryFn: async ({ signal }) => {
            const answer = await engine.query(
                {
                    program: {
                        resource: 'programs',
                        id: programId,
                        params: { fields: PROGRAM_FIELDS },
                    },
                    info: { resource: 'system/info' },
                    me: { resource: 'me', params: { fields: 'authorities' } },
                },
                { signal }
            )
            return {
                program: programSchema.parse(answer.program),
                settings: settingsOf(systemInfoSchema.parse(answer.info)),
                mayUncomplete: mayUncomplete(meSchema.parse(answer.me)),
            }
        },
        staleTime: HOUR,
    })
    const event = useQuery({
        queryKey: ['event-form', 'event', eventId],
        queryFn: async ({ signal }) =>
            heldEventSchema.parse(
                (
                    await engine.query(
                        {
                            event: {
                                resource: 'tracker/events',
                                id: eventId,
                                params: { fields: EVENT_FIELDS },
                            },
                        },
                        { signal }
                    )
                ).event
            ),
        enabled: eventId !== undefined,
    })

    // Made once per answer, so what is computed from the form keeps.
    const form = useMemo(
        () => program.data && stageFormOf(program.data.program, programStageId),
        [program.data, programStageId]
    )

    // An edit keeps the event's own org unit.
    const unitId = event.data?.orgUnit ?? orgUnitId
    const placed = form !== undefined && form.featureType !== 'NONE'
    const needsAncestors =
        form !== undefined && limitedByOrgUnit(form.categories)
    const needsOrgUnits =
        (needsAncestors || placed) &&
        (eventId === undefined || event.data !== undefined)
    const fields = placed ? 'path,displayName,geometry' : 'path'
    const orgUnits = useQuery({
        queryKey: ['event-form', 'org-unit', unitId, fields],
        queryFn: async ({ signal }) => {
            const answer = await engine.query(
                {
                    orgUnit: {
                        resource: 'organisationUnits',
                        id: unitId,
                        params: { fields },
                    },
                },
                { signal }
            )
            const { path, displayName, geometry } = orgUnitSchema.parse(
                answer.orgUnit
            )
            return {
                ancestors: new Set(path.split('/').filter((id) => id !== '')),
                orgUnit: placed
                    ? { name: displayName ?? unitId, geometry }
                    : undefined,
            }
        },
        enabled: needsOrgUnits,
        staleTime: HOUR,
    })

    // A failed refetch after a save keeps the form that is open.
    const error =
        (program.data === undefined ? program.error : null) ??
        (eventId !== undefined && event.data === undefined
            ? event.error
            : null) ??
        (needsAncestors && orgUnits.data === undefined ? orgUnits.error : null)
    if (error !== null) {
        return { status: 'error', error }
    }
    if (
        program.data === undefined ||
        (eventId !== undefined && event.data === undefined) ||
        // The location is only checked against the org unit: without it, the form opens all the same.
        (needsOrgUnits && orgUnits.data === undefined && !orgUnits.isError)
    ) {
        return { status: 'loading' }
    }
    if (form === undefined) {
        return {
            status: 'error',
            error: new Error(i18n.t('This program has no such stage')),
        }
    }
    return {
        status: 'ready',
        form,
        settings: program.data.settings,
        held: event.data,
        orgUnits: orgUnits.data?.ancestors ?? NO_ORG_UNITS,
        orgUnit: orgUnits.data?.orgUnit,
        mayUncomplete: program.data.mayUncomplete,
    }
}

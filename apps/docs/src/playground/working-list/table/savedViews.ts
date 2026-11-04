import {
    ProgramStageWorkingListSchema,
    TrackedEntityInstanceFilterSchema,
} from '@/components/working-list/api/schemas'
import { z } from 'zod'
import {
    ATTRIBUTES,
    DATA_ELEMENTS,
    LAB_PROGRAM,
    LAB_STAGE,
    VILLAGES,
    type LabConfig,
} from './labData'

type TrackedEntityView = z.input<typeof TrackedEntityInstanceFilterSchema>
type StageView = z.input<typeof ProgramStageWorkingListSchema>

export type SavedViewResource =
    | 'trackedEntityInstanceFilters'
    | 'programStageWorkingLists'

/** What a saved view request asks of the store. */
export interface SavedViewRequest {
    id?: string
    data?: unknown
}

export type RequestType = 'read' | 'create' | 'update' | 'replace' | 'delete'

/** The stage view an event list opens on. */
export const EVENT_VIEW = 'labViewVisi'

const program = { id: LAB_PROGRAM }
const programStage = { id: LAB_STAGE }
const readOnly = { read: true, update: false, delete: false, write: false }
const owned = { read: true, update: true, delete: true, write: true }

const trackedEntityView = (
    id: string,
    displayName: string,
    sortOrder: number,
    entityQueryCriteria: TrackedEntityView['entityQueryCriteria']
): TrackedEntityView => ({
    id,
    displayName,
    sortOrder,
    program,
    entityQueryCriteria,
})

/** The saved views a fresh server holds for this config. */
const seedViews = ({ data, server }: Pick<LabConfig, 'data' | 'server'>) => {
    const access = server.viewAccess === 'owner' ? owned : readOnly
    // A list of events needs a stage's saved view to open on.
    const visits: StageView = {
        id: EVENT_VIEW,
        displayName: 'Follow-up visits',
        sortOrder: 5,
        program,
        programStage,
        access: readOnly,
        programStageQueryCriteria: {},
    }
    if (server.savedViews === 'none') {
        return {
            trackedEntity: [],
            stage: data.mode === 'event' ? [visits] : [],
        }
    }
    const trackedEntity: TrackedEntityView[] = [
        trackedEntityView('labViewWome', 'Women', 0, {
            attributeValueFilters: [{ attribute: ATTRIBUTES.sex, in: ['F'] }],
        }),
        trackedEntityView('labViewActi', 'Active, newest first', 1, {
            enrollmentStatus: 'ACTIVE',
            order: 'enrolledAt:desc',
        }),
        trackedEntityView('labViewFoll', 'Marked for follow-up', 2, {
            followUp: true,
            displayColumnOrder: [
                ATTRIBUTES.nationalId,
                ATTRIBUTES.firstName,
                ATTRIBUTES.lastName,
                ATTRIBUTES.phone,
                ATTRIBUTES.village,
            ],
        }),
    ]
    const stage: StageView[] = [
        visits,
        {
            id: 'labViewOver',
            displayName: 'Visits not yet done',
            sortOrder: 6,
            program,
            programStage,
            programStageQueryCriteria: {
                eventStatus: 'SCHEDULE',
                order: 'scheduledAt:asc',
            },
        },
        {
            id: 'labViewHeav',
            displayName: 'Weight 80 kg and over',
            sortOrder: 7,
            program,
            programStage,
            programStageQueryCriteria: {
                dataFilters: [{ dataItem: DATA_ELEMENTS.weight, ge: '80' }],
            },
        },
    ]
    if (server.savedViews === 'many') {
        VILLAGES.forEach(([code, name], index) =>
            trackedEntity.push(
                trackedEntityView(
                    `labViewV${code}`,
                    `Living in ${name}`,
                    10 + index,
                    {
                        attributeValueFilters: [
                            { attribute: ATTRIBUTES.village, in: [code] },
                        ],
                    }
                )
            )
        )
        for (const [index, status] of (
            ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const
        ).entries()) {
            trackedEntity.push(
                trackedEntityView(
                    `labViewS${status.slice(0, 3)}`,
                    `${status[0]}${status.slice(1).toLowerCase()} enrollments, with a long name to see how it wraps`,
                    20 + index,
                    { enrollmentStatus: status }
                )
            )
        }
    }
    return {
        trackedEntity: trackedEntity.map((view) => ({ ...view, access })),
        stage: stage.map((view) =>
            view.id === EVENT_VIEW ? view : { ...view, access }
        ),
    }
}

const ok = (uid?: string) => ({
    httpStatus: 'OK',
    httpStatusCode: 200,
    status: 'OK',
    response: uid ? { uid } : {},
})

const notFound = () =>
    Object.assign(new Error('Not found'), { details: { httpStatusCode: 404 } })

/** A mutation's body read through the block's own schema, so the store keeps only what DHIS2 would. */
const TrackedEntityBody = TrackedEntityInstanceFilterSchema.omit({
    id: true,
    access: true,
})
const StageBody = ProgramStageWorkingListSchema.omit({ id: true, access: true })

/** A write names the view `name`; DHIS2 answers reads with it as `displayName`. */
const bodyOf = ({ data }: SavedViewRequest) => {
    const named = z
        .object({ name: z.string().optional() })
        .passthrough()
        .parse(data)
    return { displayName: named.name, ...named }
}

/** One resource's saved views, answering the block's reads and writes. */
const store = <View extends { id: string }>(
    seeded: View[],
    /** The view a write makes: a new one with `id`, or `existing` changed. */
    parse: (request: SavedViewRequest, id: string, existing?: View) => View,
    resource: SavedViewResource,
    nextId: () => string
) => {
    let views = seeded
    return (request: SavedViewRequest, type: RequestType) => {
        switch (type) {
            case 'create': {
                const id = nextId()
                views = [...views, parse(request, id)]
                return ok(id)
            }
            case 'replace':
            case 'update':
                views = views.map((view) =>
                    view.id === request.id
                        ? parse(request, view.id, view)
                        : view
                )
                return ok(request.id)
            case 'delete':
                views = views.filter((view) => view.id !== request.id)
                return ok()
            default: {
                if (!request.id) return { [resource]: views }
                const view = views.find((each) => each.id === request.id)
                if (!view) throw notFound()
                return view
            }
        }
    }
}

/**
 * The saved views of one run of the lab: seeded from the config, then
 * created, replaced and deleted as the block asks, until the next run.
 */
export const createSavedViews = (
    config: Pick<LabConfig, 'data' | 'server'>
) => {
    const seeded = seedViews(config)
    let created = 0
    const nextId = () => `labNewVw${String(++created).padStart(3, '0')}`
    return {
        trackedEntityInstanceFilters: store(
            seeded.trackedEntity.map((view) =>
                TrackedEntityInstanceFilterSchema.parse(view)
            ),
            (request, id, existing) => ({
                ...TrackedEntityBody.parse(bodyOf(request)),
                id,
                access: existing?.access ?? owned,
            }),
            'trackedEntityInstanceFilters',
            nextId
        ),
        programStageWorkingLists: store(
            seeded.stage.map((view) =>
                ProgramStageWorkingListSchema.parse(view)
            ),
            (request, id, existing) => ({
                ...StageBody.parse(bodyOf(request)),
                id,
                access: existing?.access ?? owned,
            }),
            'programStageWorkingLists',
            nextId
        ),
    }
}

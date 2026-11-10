import {
    generateLabData,
    LAB_PERSON,
    type LabData,
    type LabSettings,
} from './labData'
import { viewAttribute } from './labRelationships'
import { SUBJECTS } from './labSubjects'
import { answer as answerObservations } from '../observation-cards/labServer'
import { DEFAULT_SETTINGS as OBSERVATION_DEFAULTS } from '../observation-cards/presets'

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: Record<string, string | number | boolean>
}

/** Every resource the block asks for, and the observation cards' for the facts line. */
export const RESOURCES = [
    'tracker/trackedEntities',
    'programs',
    'trackedEntityTypes',
    'organisationUnits',
    'tracker/enrollments',
    'tracker/events',
    'tracker/relationships',
    'relationshipTypes',
    'trackedEntityAttributes',
]

/** An error shaped like the ones app-runtime throws for an HTTP failure. */
/** The ids of a `id:in:[a,b]` filter. */
const idsOf = (filter: string | number | boolean | undefined) =>
    String(filter)
        .replace(/^id:in:\[|\]$/g, '')
        .split(',')

const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

/** What the lab's DHIS2 answers; how slowly, or whether at all, is the lab network's call. */
export const answer = (
    settings: LabSettings,
    data: LabData = generateLabData(settings)
) => {
    const subject = SUBJECTS[settings.record]
    const observations = answerObservations(
        { ...OBSERVATION_DEFAULTS, calendar: settings.calendar },
        data.observations
    )
    return (request: LabRequest) => {
        switch (request.resource) {
            case 'tracker/trackedEntities':
                if (request.id !== LAB_PERSON) {
                    throw httpError(404, `Person ${request.id} not found`)
                }
                if (settings.restricted) {
                    throw httpError(403, 'Forbidden')
                }
                if (settings.missing) {
                    throw httpError(404, `Person ${request.id} not found`)
                }
                if (request.params?.program === undefined) {
                    return data.record.without
                }
                // As DHIS2 does for a person not enrolled in the program.
                if (
                    request.params.program !== subject.program ||
                    settings.enrollment === 'none'
                ) {
                    throw httpError(404, `Person ${request.id} not found`)
                }
                return data.record.withProgram
            case 'programs':
                if (request.id !== subject.program) {
                    throw httpError(404, `Program ${request.id} not found`)
                }
                // The observation cards ask for the same resource for the stages.
                return data.program
            case 'trackedEntityTypes':
                return data.type
            case 'tracker/relationships':
                return {
                    relationships:
                        request.params?.trackedEntity === LAB_PERSON
                            ? data.relationships.relationships
                            : [],
                }
            case 'relationshipTypes': {
                const ids = idsOf(request.params?.filter)
                return {
                    relationshipTypes: data.relationships.types.filter((t) =>
                        ids.includes(t.id)
                    ),
                }
            }
            case 'trackedEntityAttributes':
                return {
                    trackedEntityAttributes: idsOf(request.params?.filter).map(
                        viewAttribute
                    ),
                }
            case 'organisationUnits':
                return { displayName: 'Ngelehun CHC' }
            default:
                return observations(request)
        }
    }
}

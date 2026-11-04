import {
    generateLabData,
    LAB_PERSON,
    LAB_PROGRAM,
    type LabData,
    type LabSettings,
} from './labData'

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: Record<string, string | number | boolean>
}

/** Every resource the block asks for. The calendar comes from app-runtime's config, not a request. */
export const RESOURCES = ['programs', 'tracker/enrollments', 'tracker/events']

const page = <T>(items: T[], params: LabRequest['params'] = {}) => {
    const pageNumber = Number(params.page ?? 1)
    const pageSize = Number(params.pageSize ?? 50)
    const first = (pageNumber - 1) * pageSize
    return {
        items: items.slice(first, first + pageSize),
        pager: { page: pageNumber, pageSize },
    }
}

/** What the lab's DHIS2 answers; how slowly, or whether at all, is the lab network's call. */
export const answer =
    (settings: LabSettings, data: LabData = generateLabData(settings)) =>
    (request: LabRequest) => {
        const params = request.params ?? {}
        const theirs =
            params.trackedEntity === LAB_PERSON &&
            params.program === LAB_PROGRAM
        switch (request.resource) {
            case 'programs':
                if (request.id !== LAB_PROGRAM) {
                    throw new Error(`Program ${request.id} not found`)
                }
                return data.program
            case 'tracker/enrollments': {
                const { items, pager } = page(
                    theirs ? data.enrollments : [],
                    params
                )
                return { pager, enrollments: items }
            }
            case 'tracker/events': {
                const { items, pager } = page(theirs ? data.events : [], params)
                return { pager, events: items }
            }
            default:
                throw new Error(
                    `The observations lab does not serve ${request.resource}`
                )
        }
    }

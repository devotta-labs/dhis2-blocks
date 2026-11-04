import {
    LAB_PROGRAM,
    programJson,
    searchJson,
    type LabSettings,
} from './labData'

/** One request as the finder sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    /** The search's paging; its filters and fields don't change what the lab answers. */
    params?: { page?: number | string; pageSize?: number | string }
}

/** Every resource the finder asks for: its program, the server's calendar and date format, and the search. */
export const RESOURCES = ['programs', 'system/info', 'tracker/trackedEntities']

/** The resources the network's Fails and Hangs choices apply to. */
export const RECORDS = ['tracker/trackedEntities']

/** An error shaped like the ones app-runtime throws for an HTTP failure. */
const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

/** What the lab's DHIS2 answers; how slowly, or whether at all, is the lab network's call. */
export const answer =
    ({ program, server }: Pick<LabSettings, 'program' | 'server'>) =>
    (request: LabRequest) => {
        switch (request.resource) {
            case 'programs':
                if (request.id !== LAB_PROGRAM) {
                    throw httpError(404, `Program ${request.id} not found`)
                }
                return programJson(program)
            case 'system/info':
                // 2.43 matches each code of a multi-select; older ones can't.
                return {
                    calendar: server.calendar,
                    dateFormat: 'YYYY-MM-DD',
                    version: '2.43.1',
                }
            case 'tracker/trackedEntities':
                return searchJson(
                    { program, server },
                    Number(request.params?.page ?? 1),
                    Number(request.params?.pageSize ?? 10)
                )
            default:
                throw new Error(
                    `The finder lab does not serve ${request.resource}`
                )
        }
    }

import { ORG_UNITS, USERS } from './labData'

/** One request as the block sends it through app-runtime; an upload carries its file in `data`. */
export interface LabRequest {
    resource: string
    params?: { query?: string }
    data?: { file?: File }
}

/** Every resource the block asks for: the org unit and user searches, and uploads. All can fail or hang. */
export const RESOURCES = ['organisationUnits', 'userLookup', 'fileResources']

const matches = (query: string, ...texts: string[]) =>
    texts.some((text) => text.toLowerCase().includes(query.toLowerCase()))

/**
 * What the lab's DHIS2 answers. Each upload is kept in `uploads` (id to file name) until the next run, so the lab
 * knows the name of a file it was given.
 */
export const answer =
    (uploads: Map<string, string>) =>
    (
        request: LabRequest,
        type: 'read' | 'create' | 'update' | 'replace' | 'delete'
    ) => {
        const query = request.params?.query ?? ''
        switch (request.resource) {
            case 'organisationUnits': {
                const found = ORG_UNITS.filter(
                    ({ id, displayName }) =>
                        id === query || matches(query, displayName)
                )
                return {
                    pager: { page: 1, pageCount: 1, total: found.length },
                    organisationUnits: found,
                }
            }
            // The lookup sends the first few matches, without a pager.
            case 'userLookup':
                return {
                    users: USERS.filter(({ username, displayName }) =>
                        matches(query, username, displayName)
                    ),
                }
            case 'fileResources': {
                const file = request.data?.file
                if (type !== 'create' || file === undefined) {
                    throw new Error('Upload a file as multipart form data')
                }
                const id = `labUpload${String(uploads.size + 1).padStart(2, '0')}`
                uploads.set(id, file.name)
                return {
                    httpStatus: 'Accepted',
                    httpStatusCode: 202,
                    status: 'OK',
                    message: 'Upload successful',
                    response: {
                        responseType: 'FileResource',
                        fileResource: {
                            id,
                            name: file.name,
                            contentType: file.type,
                            contentLength: file.size,
                            domain: 'DATA_VALUE',
                            storageStatus: 'PENDING',
                        },
                    },
                }
            }
            default:
                throw new Error(
                    `The value input lab does not serve ${request.resource}`
                )
        }
    }

import {
    createClinicClient,
    type DataEngineLike,
    type ResourceRequest,
} from '../api/client'
import type { AssignedClinic, Clinic } from '../api/schemas'

/** A unit whose id is its name padded to a uid. */
export const unit = (name: string, parent = ''): Clinic => {
    const id = name.padEnd(11, '0')
    return { id, displayName: name, path: `${parent}/${id}` }
}
export const district = (name: string): AssignedClinic => ({
    ...unit(name),
    hasChildren: true,
})
export const facility = (name: string, parent = ''): AssignedClinic => ({
    ...unit(name, parent),
    hasChildren: false,
})

export const OCEAN = facility('Ocean')
export const BRISTOL = facility('Bristol')

interface ServerOptions {
    userId?: string
    assigned?: AssignedClinic[]
    /** What the by-id check finds; ids not here come back missing. */
    known?: Clinic[]
    found?: Clinic[]
    /** How many matches the search pager reports; `found.length` by default. */
    total?: number
}

/** Who a later `me` request says the user is. */
interface FakeMe {
    userId: string
    assigned: AssignedClinic[]
}

/** HTTP statuses the server answers with while set. */
interface Failures {
    me?: number | undefined
    byId?: number | undefined
    search?: number | undefined
}

const failure = (status: number) =>
    Object.assign(new Error('boom'), { httpStatusCode: status })

/** Copies, so the engine sees plain response objects. */
const plain = (clinics: Clinic[]) => clinics.map((clinic) => ({ ...clinic }))

export const createServer = ({
    userId = 'u1',
    assigned = [OCEAN, BRISTOL],
    known = [],
    found = [],
    total = found.length,
}: ServerOptions = {}) => {
    const requests: ResourceRequest[] = []
    const me: FakeMe = { userId, assigned }
    const fail: Failures = {}
    let meHeld: Promise<void> | undefined
    let releaseMe = () => {}
    let searchHeld: Promise<void> | undefined
    let releaseSearch = () => {}
    const server = {
        me,
        fail,
        /** Holds `me` requests open until `releaseMe` is called. */
        holdMe: () => {
            meHeld = new Promise((resolve) => {
                releaseMe = resolve
            })
        },
        releaseMe: () => releaseMe(),
        /** Holds search requests open until `releaseSearch` is called. */
        holdSearch: () => {
            searchHeld = new Promise((resolve) => {
                releaseSearch = resolve
            })
        },
        releaseSearch: () => releaseSearch(),
        meRequests: () =>
            requests.filter((request) => request.resource === 'me'),
        byIdRequests: () =>
            requests.filter((request) => request.params?.filter !== undefined),
        searchRequests: () =>
            requests.filter((request) => request.params?.query !== undefined),
        client: createClinicClient({
            query: async (query) => {
                const [[key, request]] = Object.entries(query)
                requests.push(request)
                if (request.resource === 'me') {
                    await meHeld
                    if (fail.me !== undefined) {
                        throw failure(fail.me)
                    }
                    return {
                        [key]: {
                            id: me.userId,
                            organisationUnits: me.assigned.map(
                                ({ hasChildren, ...rest }) => ({
                                    ...rest,
                                    children: hasChildren,
                                })
                            ),
                        },
                    }
                }
                const filter = request.params?.filter
                if (filter !== undefined) {
                    if (fail.byId !== undefined) {
                        throw failure(fail.byId)
                    }
                    const ids = String(filter)
                        .slice('id:in:['.length, -1)
                        .split(',')
                    return {
                        [key]: {
                            organisationUnits: plain(
                                known.filter(({ id }) => ids.includes(id))
                            ),
                        },
                    }
                }
                await searchHeld
                if (fail.search !== undefined) {
                    throw failure(fail.search)
                }
                return {
                    [key]: {
                        pager: { total },
                        organisationUnits: plain(found),
                    },
                }
            },
        } satisfies DataEngineLike),
    }
    return server
}

export type ClinicServer = ReturnType<typeof createServer>

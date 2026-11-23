import {
    createOrgUnitClient,
    type DataEngineLike,
    type ResourceRequest,
} from '../api/client'
import type { AssignedOrgUnit, OrgUnit } from '../api/schemas'

/** A unit whose id is its name padded to a uid. */
export const unit = (name: string, parent = '') => {
    const id = name.padEnd(11, '0')
    return { id, displayName: name, path: `${parent}/${id}` }
}
export const district = (name: string) => ({
    ...unit(name),
    hasChildren: true,
})
export const facility = (name: string, parent = '') => ({
    ...unit(name, parent),
    hasChildren: false,
})

export const OCEAN = facility('Ocean')
export const BRISTOL = facility('Bristol')

interface ServerOptions {
    userId?: string
    assigned?: AssignedOrgUnit[]
    /** What the by-id check finds; ids not here come back missing. */
    known?: OrgUnit[]
    /** What a query finds, whatever the query. */
    found?: OrgUnit[]
    /** The hierarchy a blank query pages through. */
    all?: OrgUnit[]
}

interface FakeMe {
    userId: string
    assigned: AssignedOrgUnit[]
}

interface Failures {
    me?: number | undefined
    byId?: number | undefined
    search?: number | undefined
}

const failure = (status: number) =>
    Object.assign(new Error('boom'), { httpStatusCode: status })

const plain = (orgUnits: OrgUnit[]) =>
    orgUnits.map((orgUnit) => ({ ...orgUnit }))

export const createServer = ({
    userId = 'u1',
    assigned = [OCEAN, BRISTOL],
    known = [],
    found = [],
    all = [],
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

        holdMe: () => {
            meHeld = new Promise((resolve) => {
                releaseMe = resolve
            })
        },
        releaseMe: () => releaseMe(),

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
            requests.filter(
                (request) =>
                    request.resource === 'organisationUnits' &&
                    request.params?.filter === undefined
            ),
        client: createOrgUnitClient({
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
                const page = Number(request.params?.page)
                const pageSize = Number(request.params?.pageSize)
                const matches =
                    request.params?.query === undefined ? all : found
                return {
                    [key]: {
                        pager: { page, pageSize, total: matches.length },
                        organisationUnits: plain(
                            matches.slice(
                                (page - 1) * pageSize,
                                page * pageSize
                            )
                        ),
                    },
                }
            },
        } satisfies DataEngineLike),
    }
    return server
}

export type OrgUnitServer = ReturnType<typeof createServer>

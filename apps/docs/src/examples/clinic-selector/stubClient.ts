import {
    createClinicClient,
    type ClinicClient,
} from '@/components/clinic-selector'

export type Scenario = 'one' | 'three'

const FACILITIES = {
    one: [{ id: 'Rp268JB6Ne4', displayName: 'Adonkia CHP' }],
    three: [
        { id: 'DiszpKrYNg8', displayName: 'Ngelehun CHC' },
        { id: 'Rp268JB6Ne4', displayName: 'Adonkia CHP' },
        { id: 'cDw53Ej8rju', displayName: 'Ahamadyya Mission Clinic' },
    ],
}

/**
 * A clinic client over a made-up user. It answers the requests the block
 * makes without a server. Your own data layer goes through
 * `createClinicClient` the same way: it needs one `query` method.
 */
export const stubClient = (scenario: Scenario): ClinicClient =>
    createClinicClient({
        query: async (query) => {
            const [[key, request]] = Object.entries(query)
            if (request.resource === 'me') {
                return {
                    [key]: {
                        id: `user-${scenario}`,
                        organisationUnits: FACILITIES[scenario].map(
                            (facility) => ({
                                ...facility,
                                path: `/ImspTQPwCqd/${facility.id}`,
                                children: false,
                            })
                        ),
                    },
                }
            }
            // Searching and remembered-id checks find nothing in a stub.
            return { [key]: { organisationUnits: [] } }
        },
    })

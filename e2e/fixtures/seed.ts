import { z } from 'zod'
import metadata from '../metadata/working-list-metadata.json' with { type: 'json' }
import users from '../metadata/working-list-users.json' with { type: 'json' }
import lists from '../metadata/working-list-saved-lists.json' with { type: 'json' }
import setup from '../metadata/working-list-setup.json' with { type: 'json' }
import tracker from '../metadata/working-list-tracker-data.json' with { type: 'json' }
const reference = z.object({ id: z.string() })
const field = reference.extend({ valueType: z.string() })

export const seedMetadata = z
    .object({
        programs: z.array(
            reference.extend({
                name: z.string(),
                organisationUnits: z.array(reference),
            })
        ),
        programStages: z.array(
            reference.extend({ name: z.string(), program: reference })
        ),
        trackedEntityAttributes: z.array(field),
        dataElements: z.array(field),
        userRoles: z.array(reference),
        userGroups: z.array(reference),
    })
    .parse(metadata)

export const seedUsers = z
    .object({
        users: z.array(
            reference.extend({
                username: z.string(),
                password: z.string(),
                surname: z.string(),
                userRoles: z.array(reference),
                userGroups: z.array(reference),
                organisationUnits: z.array(reference),
            })
        ),
    })
    .parse(users).users

export const seedLists = z
    .object({
        lists: z.array(
            reference.extend({
                name: z.string(),
                resource: z.literal('trackedEntityInstanceFilters'),
                data: reference.extend({ program: reference }).passthrough(),
            })
        ),
        sharing: reference.extend({
            resource: z.string(),
            userGroupAccesses: z.array(
                reference.extend({ access: z.string() })
            ),
            userAccesses: z.array(reference),
        }),
    })
    .parse(lists)

export const invalidDate = z
    .object({
        invalidDate: z.object({
            trackedEntity: z.string(),
            attribute: z.string(),
            value: z.string(),
        }),
    })
    .parse(setup).invalidDate

export const seedTracker = z
    .object({
        trackedEntities: z.array(
            z.object({
                trackedEntity: z.string(),
                attributes: z.array(
                    z.object({ attribute: z.string(), value: z.string() })
                ),
            })
        ),
    })
    .parse(tracker)

export const seedUser = (surname: string) => {
    const user = seedUsers.find((entry) => entry.surname === surname)
    if (!user) throw new Error(`Missing seed user: ${surname}`)
    return user
}

export const seedList = (name: string) => {
    const list = seedLists.lists.find((entry) => entry.name === name)
    if (!list) throw new Error(`Missing seed list: ${name}`)
    return list
}

export const seedFieldId = (
    kind: 'trackedEntityAttributes' | 'dataElements',
    valueType: string
) => {
    const matches = seedMetadata[kind].filter(
        (entry) => entry.valueType === valueType
    )
    if (matches.length !== 1)
        throw new Error(`Expected one ${kind} ${valueType} seed`)
    return matches[0].id
}

import type { z } from 'zod'
import { PAGE_SIZE } from '../rules/searchParams'
import type { ProgramModel } from '../rules/types'
import { FinderRequestError } from './requestErrors'
import {
    normaliseTrackedEntities,
    type TrackedEntitiesResponseSchema,
    type RawTrackedEntity,
} from './schemas'

export interface FinderPerson {
    trackedEntity: string
    trackedEntityType: string
    orgUnit: string
    /** The owner orgUnit for the finder's program. */
    programOwner?: string
    attributes: Record<string, string>
}

export type SearchOutcome =
    | {
          kind: 'results'
          people: FinderPerson[]
          total?: number
          page: number
          hasNext: boolean
      }
    | { kind: 'too-many' }

const TOO_MANY_MARKER = 'maxteicountreached'

export const isTooManyConflict = (cause: unknown) =>
    cause instanceof FinderRequestError &&
    cause.status === 409 &&
    [cause.serverMessage, cause.message].some((text) =>
        text?.toLowerCase().includes(TOO_MANY_MARKER)
    )

const toPerson = (row: RawTrackedEntity, program: string): FinderPerson => {
    const person: FinderPerson = {
        trackedEntity: row.trackedEntity,
        trackedEntityType: row.trackedEntityType,
        orgUnit: row.orgUnit,
        attributes: Object.fromEntries(
            row.attributes.map(({ attribute, value }) => [attribute, value])
        ),
    }
    const owner = row.programOwners.find(
        (candidate) => candidate.program === program
    )
    if (owner) {
        person.programOwner = owner.orgUnit
    }
    return person
}

/** Going over the result cap is an answer, with no people exposed. */
export const toSearchOutcome = (
    response: z.infer<typeof TrackedEntitiesResponseSchema>,
    model: ProgramModel,
    page: number
): SearchOutcome => {
    const { rows, total } = normaliseTrackedEntities(response)
    // Without a total, only a short first page proves the search is below
    // the cap. Never expose rows when the total could exceed it.
    const count =
        total ??
        (page === 1 && rows.length < PAGE_SIZE
            ? rows.length
            : Number.POSITIVE_INFINITY)
    if (model.maxResults > 0 && count > model.maxResults) {
        return { kind: 'too-many' }
    }
    return {
        kind: 'results',
        people: rows.map((row) => toPerson(row, model.program)),
        total,
        page,
        hasNext:
            total !== undefined
                ? page * PAGE_SIZE < total
                : rows.length === PAGE_SIZE,
    }
}

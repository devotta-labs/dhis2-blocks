import { PAGE_SIZE, toSearchParams } from '../rules/searchParams'
import type { ProgramModel, ValidatedSearch } from '../rules/types'
import { FinderRequestError, type FinderResourceClient } from './client'
import {
    normaliseTrackedEntities,
    TrackedEntitiesResponseSchema,
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
          page: number
          hasNext: boolean
      }
    | { kind: 'too-many' }

const TOO_MANY_MARKER = 'maxteicountreached'

const isTooManyConflict = (cause: unknown) =>
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

/** A failed request throws; going over the result cap is an answer. */
export const runSearch = async (
    client: FinderResourceClient,
    model: ProgramModel,
    search: ValidatedSearch,
    page: number,
    signal?: AbortSignal
): Promise<SearchOutcome> => {
    let response
    try {
        response = await client.query(
            {
                resource: 'tracker/trackedEntities',
                params: toSearchParams(model, search, page),
            },
            TrackedEntitiesResponseSchema,
            signal
        )
    } catch (error) {
        if (isTooManyConflict(error) && !signal?.aborted) {
            return { kind: 'too-many' }
        }
        throw error
    }
    const { rows, total } = normaliseTrackedEntities(response)
    if (
        total !== undefined &&
        model.maxResults > 0 &&
        total > model.maxResults
    ) {
        return { kind: 'too-many' }
    }
    return {
        kind: 'results',
        people: rows.map((row) => toPerson(row, model.program)),
        page,
        hasNext:
            total !== undefined
                ? page * PAGE_SIZE < total
                : rows.length === PAGE_SIZE,
    }
}

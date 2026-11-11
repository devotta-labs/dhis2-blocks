import type { FetchError } from '@dhis2/app-runtime'
import { PAGE_SIZE } from '../rules/searchParams'
import type { ProgramModel } from '../rules/types'
import {
    normaliseTrackedEntities,
    type RawTrackedEntity,
    type TrackedEntitiesResponse,
} from './schemas'

export interface FinderPerson {
    trackedEntity: string
    trackedEntityType: string
    orgUnit: string
    /** The owner orgUnit for the finder's program. */
    programOwner?: string
    attributes: Record<string, string>
}

/** One page of a search: its people, or that it matched too many to show. */
export type SearchOutcome =
    | {
          kind: 'results'
          people: FinderPerson[]
          page: number
          hasNext: boolean
      }
    | { kind: 'too-many' }

const TOO_MANY_MARKER = 'maxteicountreached'

/** DHIS2 answers a search over the program's cap with this conflict, not rows. */
export const isTooManyConflict = ({ details, message }: FetchError) =>
    details.httpStatusCode === 409 &&
    [details.message, message].some((text) =>
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

/** Reads one page of a search, holding it against the program's result cap. */
export const toSearchOutcome = (
    model: ProgramModel,
    response: TrackedEntitiesResponse,
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
        page,
        hasNext:
            total !== undefined
                ? page * PAGE_SIZE < total
                : rows.length === PAGE_SIZE,
    }
}

import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { DataEngine } from '../sources/types'

// Fewer characters match too much to be worth asking the server.
export const MIN_LENGTH = 2
// A word typed in one go is searched once, when typing stops.
const DEBOUNCE_MS = 250

/** A result of a search: the value it saves, and how the list shows it. */
interface SearchResult {
    value: string
    name: string
    /** Shown under the name. */
    detail: string
}

interface SearchAnswer {
    results: ReadonlyArray<SearchResult>
    /** How many match; more than the results when the server sent only some. */
    total: number
}

type Search = (
    engine: DataEngine,
    query: string,
    signal: AbortSignal
) => Promise<SearchAnswer>

/** A value type's search: how it asks the server, and what it says when nothing is found. */
export interface ServerSearch {
    search: Search
    /** Said when a search finds nothing. */
    none: string
}

const orgUnitSchema = z.object({
    orgUnits: z.object({
        pager: z.object({ total: z.number() }),
        organisationUnits: z.array(
            z.object({
                id: z.string(),
                displayName: z.string(),
                ancestors: z.array(z.object({ displayName: z.string() })),
            })
        ),
    }),
})

/** The org units within the user's search scope matching the query, each with its path as names, in one request. */
const searchOrgUnits: Search = async (engine, query, signal) => {
    const { orgUnits } = orgUnitSchema.parse(
        await engine.query(
            {
                orgUnits: {
                    resource: 'organisationUnits',
                    params: {
                        query,
                        withinUserSearchHierarchy: true,
                        // Ancestors come from the top of the hierarchy down.
                        fields: 'id,displayName,ancestors[displayName]',
                    },
                },
            },
            { signal }
        )
    )
    return {
        total: orgUnits.pager.total,
        results: orgUnits.organisationUnits.map(
            ({ id, displayName, ancestors }) => ({
                value: id,
                name: displayName,
                detail: ancestors.map((each) => each.displayName).join(' / '),
            })
        ),
    }
}

const userSchema = z.object({
    users: z.object({
        users: z.array(
            z.object({ username: z.string(), displayName: z.string() })
        ),
    }),
})

/** The users matching the query by name or username; the lookup sends the first few, without a total. */
const searchUsers: Search = async (engine, query, signal) => {
    const { users } = userSchema.parse(
        await engine.query(
            { users: { resource: 'userLookup', params: { query } } },
            { signal }
        )
    )
    return {
        total: users.users.length,
        results: users.users.map(({ username, displayName }) => ({
            value: username,
            name: displayName,
            detail: username,
        })),
    }
}

/** The search of a `search` kind's value type: org units in the user's search scope, or DHIS2's user lookup. */
export const searchFor = (valueType: string): ServerSearch | undefined => {
    if (valueType === 'ORGANISATION_UNIT') {
        return {
            search: searchOrgUnits,
            none: i18n.t('No organisation units found'),
        }
    }
    if (valueType === 'USERNAME') {
        return { search: searchUsers, none: i18n.t('No users found') }
    }
    return undefined
}

/** The answer for a query, or why there is none. */
export interface Found extends SearchAnswer {
    query: string
    problem?: string
}

/**
 * The server's answer for `query`, from two characters on and once typing stops; a newer query aborts the search
 * before it. Undefined until the answer for this very query arrives, so nothing picks from an older one.
 */
export const useServerSearch = (
    search: Search | undefined,
    query: string
): Found | undefined => {
    const engine = useDataEngine()
    const [found, setFound] = useState<Found>()
    useEffect(() => {
        if (search === undefined || query.length < MIN_LENGTH) {
            return undefined
        }
        const controller = new AbortController()
        const timer = setTimeout(() => {
            search(engine, query, controller.signal).then(
                (answer) => {
                    if (!controller.signal.aborted) {
                        setFound({ query, ...answer })
                    }
                },
                (error: Error) => {
                    if (!controller.signal.aborted) {
                        setFound({
                            query,
                            results: [],
                            total: 0,
                            problem:
                                error instanceof FetchError &&
                                error.type === 'network'
                                    ? i18n.t('You are offline')
                                    : i18n.t('Could not search. Try again.'),
                        })
                    }
                }
            )
        }, DEBOUNCE_MS)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [search, query])
    return found?.query === query ? found : undefined
}

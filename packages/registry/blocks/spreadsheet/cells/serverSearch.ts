import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { skipToken, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { DataEngine } from '../provider/context'

// Fewer characters match too much to be worth asking the server.
export const MIN_LENGTH = 2
// A word typed in one go is searched once, when typing stops.
export const DEBOUNCE_MS = 250

/** A result of a search: the value it saves, and how the list shows it. */
interface SearchResult {
    value: string
    name: string
    /** Shown under the name. */
    detail: string
}

export interface SearchAnswer {
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

/** Why a search failed, for the person: no connection, or anything else. */
export const searchProblem = (error: Error) =>
    error instanceof FetchError && error.type === 'network'
        ? i18n.t('You are offline')
        : i18n.t('Could not search. Try again.')

/** `value`, once it has stayed the same for `ms`. */
export const useDebounced = (value: string, ms: number) => {
    const [settled, setSettled] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), ms)
        return () => clearTimeout(timer)
    }, [value, ms])
    return settled
}

/**
 * What the server finds for `query`, from two characters on; a newer query aborts the search before it. A value type
 * with no search asks nothing.
 */
export const useServerSearch = (valueType: string, query: string) => {
    const engine = useDataEngine()
    const search = searchFor(valueType)?.search
    return useQuery({
        queryKey: ['spreadsheet', 'search', valueType, query],
        queryFn:
            search === undefined || query.length < MIN_LENGTH
                ? skipToken
                : ({ signal }) => search(engine, query, signal),
        // Enter and Tab wait for the answer, so a failure is said at once; the next key searches again.
        retry: false,
        // Asked even when the browser says it is offline: the failure then says so, where a paused search says nothing.
        networkMode: 'always',
    })
}

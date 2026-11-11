import { describe, expect, it } from 'vitest'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from '../rules/programModel'
import { seal } from '../rules/seal'
import { QueryClient } from '@tanstack/react-query'
import { searchQueryOptions, type FinderEngine } from './queries'
import type { ProgramModel, ValidatedSearch } from '../rules/types'

const search = seal([
    { attribute: 'artNumber', conditions: [{ op: 'eq', value: 'A1' }] },
])
const model = buildProgramModel(hivProgram)
const uncapped = buildProgramModel({ ...hivProgram, maxTeiCountToReturn: 0 })

const entity = (id: string) => ({
    trackedEntity: id,
    trackedEntityType: 'personType',
    orgUnit: 'ouA',
    programOwners: [
        { orgUnit: 'ouOther', program: 'otherProgram' },
        { orgUnit: 'ouOwner', program: 'hivProgram' },
    ],
    attributes: [{ attribute: 'artNumber', value: 'A1' }],
})

type Engine = FinderEngine['query']
type Answer = Awaited<ReturnType<Engine>>[string]

const clientOf = (respond: () => Answer) => ({
    query: async () => ({ trackedEntityFinderResource: respond() }),
})

const runSearch = (
    engine: FinderEngine,
    model: ProgramModel,
    search: ValidatedSearch,
    page: number,
    signal?: AbortSignal
) => {
    const options = searchQueryOptions(
        engine,
        { server: 'https://dhis2.test', userId: 'userA' },
        model,
        search,
        page
    )
    return new QueryClient().fetchQuery({
        ...options,
        queryFn: (context) =>
            options.queryFn!({ ...context, signal: signal ?? context.signal }),
        retry: false,
    })
}

const ids = (count: number) =>
    Array.from({ length: count }, (_, index) => entity(`te${index}`))

describe('runSearch', () => {
    it('returns too-many over the cap and shows no one', async () => {
        const client = clientOf(() => ({
            trackedEntities: ids(6),
            pager: { total: 6 },
        }))
        expect(await runSearch(client, model, search, 1)).toEqual({
            kind: 'too-many',
        })
    })

    it('treats cap 0 as no cap', async () => {
        const client = clientOf(() => ({
            trackedEntities: ids(10),
            pager: { total: 500 },
        }))
        const outcome = await runSearch(client, uncapped, search, 1)
        expect(outcome).toMatchObject({ kind: 'results', total: 500 })
    })

    it.each([6, 10])(
        'hides %i rows without a total when the cap is 5',
        async (count) => {
            const client = clientOf(() => ({ trackedEntities: ids(count) }))
            expect(await runSearch(client, model, search, 1)).toEqual({
                kind: 'too-many',
            })
        }
    )

    it('hides an indeterminate count even when a full page fits under the cap', async () => {
        const client = clientOf(() => ({ trackedEntities: ids(10) }))
        const capped = buildProgramModel({
            ...hivProgram,
            maxTeiCountToReturn: 15,
        })
        expect(await runSearch(client, capped, search, 1)).toEqual({
            kind: 'too-many',
        })
    })

    it('accepts a short first page within the cap without a total', async () => {
        const client = clientOf(() => ({ trackedEntities: ids(5) }))
        expect(await runSearch(client, model, search, 1)).toMatchObject({
            kind: 'results',
            hasNext: false,
        })
        expect(await runSearch(client, model, search, 2)).toEqual({
            kind: 'too-many',
        })
    })

    it('maps a 409 maxteicountreached to too-many, from either error shape', async () => {
        const nested = clientOf(() => {
            throw {
                message: 'Request failed',
                details: {
                    httpStatusCode: 409,
                    message: 'maxTeiCountReached: too many',
                },
            }
        })
        const flat = clientOf(() => {
            throw { httpStatusCode: 409, message: 'MaxTeiCountReached' }
        })
        expect(await runSearch(nested, model, search, 1)).toEqual({
            kind: 'too-many',
        })
        expect(await runSearch(flat, model, search, 1)).toEqual({
            kind: 'too-many',
        })
    })

    it('rethrows other failures', async () => {
        const other409 = clientOf(() => {
            throw { httpStatusCode: 409, message: 'Conflict' }
        })
        const server = clientOf(() => {
            throw { httpStatusCode: 500, message: 'maxTeiCountReached' }
        })
        await expect(runSearch(other409, model, search, 1)).rejects.toThrow(
            'Conflict'
        )
        await expect(runSearch(server, model, search, 1)).rejects.toThrow()
    })

    it('rethrows a too-many 409 when aborted', async () => {
        const controller = new AbortController()
        const client = clientOf(() => {
            controller.abort()
            throw { httpStatusCode: 409, message: 'maxTeiCountReached' }
        })
        await expect(
            runSearch(client, model, search, 1, controller.signal)
        ).rejects.toBeDefined()
    })

    it('picks the program owner for the program', async () => {
        const client = clientOf(() => ({
            trackedEntities: [entity('te1')],
            pager: { total: 1 },
        }))
        const outcome = await runSearch(client, model, search, 1)
        expect(outcome).toMatchObject({
            kind: 'results',
            people: [
                {
                    trackedEntity: 'te1',
                    programOwner: 'ouOwner',
                    attributes: { artNumber: 'A1' },
                },
            ],
        })
    })

    it('works out hasNext with and without a total', async () => {
        const withTotal = (page: number, total: number) =>
            runSearch(
                clientOf(() => ({
                    trackedEntities: ids(3),
                    pager: { total },
                })),
                uncapped,
                search,
                page
            )
        const without = (count: number) =>
            runSearch(
                clientOf(() => ({ trackedEntities: ids(count) })),
                uncapped,
                search,
                1
            )
        expect(await withTotal(1, 11)).toMatchObject({ hasNext: true })
        expect(await withTotal(2, 20)).toMatchObject({ hasNext: false })
        expect(await without(10)).toMatchObject({ hasNext: true })
        expect(await without(9)).toMatchObject({ hasNext: false })
    })
})

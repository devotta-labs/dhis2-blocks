import { describe, expect, it } from 'vitest'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from '../rules/programModel'
import { seal } from '../rules/seal'
import { createFinderResourceClient, type DataEngineLike } from './client'
import { runSearch } from './search'

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

type Engine = DataEngineLike['query']
type Answer = Awaited<ReturnType<Engine>>[string]

const clientOf = (respond: () => Answer) =>
    createFinderResourceClient({
        query: async () => ({ trackedEntityFinderResource: respond() }),
    })

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
        expect(outcome.kind).toBe('results')
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

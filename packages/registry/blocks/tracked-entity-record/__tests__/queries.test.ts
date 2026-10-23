import { QueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import type { ZodType } from 'zod'
import {
    RecordRequestError,
    type RecordClient,
    type ResourceRequest,
} from '../client'
import { trackedEntityRecordKeys } from '../keys'
import {
    METADATA_STALE_TIME,
    orgUnitPathsQuery,
    personQuery,
    programsQuery,
    relationshipsQuery,
    relationshipTypesQuery,
    retryRecordRequest,
    trackedEntityTypeQuery,
    userScopesQuery,
} from '../queries'
import { personRequest, programsRequest } from '../requests'

interface RecordedCall {
    request: ResourceRequest
    schema: ZodType
    signal: AbortSignal | undefined
}

const recordingClient = (calls: RecordedCall[]): RecordClient => ({
    async query(request, schema, signal) {
        calls.push({ request, schema, signal })
        // SAFETY: the tests only read the value back, never through its type.
        return Result.ok({ answered: request.resource } as never)
    },
})

const failingClient = (error: RecordRequestError): RecordClient => ({
    query: async () => Result.err(error),
})

const clientFor = () => new QueryClient()

describe('tracked entity record keys', () => {
    it('person and relationships keys share the person prefix', () => {
        const person = trackedEntityRecordKeys.person('abc')
        const relationships = trackedEntityRecordKeys.relationships('abc')

        expect(person).toEqual(['tracked-entity-record', 'person', 'abc'])
        expect(relationships).toEqual([...person, 'relationships'])
        expect(relationships.slice(0, person.length)).toEqual(person)
        expect(person.slice(0, 1)).toEqual(trackedEntityRecordKeys.root)
    })

    it('programs key sorts ids', () => {
        expect(trackedEntityRecordKeys.programs(['c', 'a', 'b'])).toEqual(
            trackedEntityRecordKeys.programs(['b', 'c', 'a'])
        )
        expect(trackedEntityRecordKeys.programs(['c', 'a', 'b'])).toEqual([
            'tracked-entity-record',
            'programs',
            ['a', 'b', 'c'],
        ])
    })

    it('id-list keys drop duplicates and do not mutate the input', () => {
        const ids = ['b', 'a', 'b']

        expect(trackedEntityRecordKeys.relationshipTypes(ids)).toEqual([
            'tracked-entity-record',
            'relationship-types',
            ['a', 'b'],
        ])
        expect(trackedEntityRecordKeys.orgUnitPaths(ids)).toEqual([
            'tracked-entity-record',
            'org-unit-paths',
            ['a', 'b'],
        ])
        expect(ids).toEqual(['b', 'a', 'b'])
    })

    it('has keys for the type and the user scopes', () => {
        expect(trackedEntityRecordKeys.trackedEntityType('t')).toEqual([
            'tracked-entity-record',
            'tracked-entity-type',
            't',
        ])
        expect(trackedEntityRecordKeys.userScopes()).toEqual([
            'tracked-entity-record',
            'user-scopes',
        ])
    })
})

describe('tracked entity record queries', () => {
    it('metadata queries have the 30 minute staleTime', () => {
        const client = recordingClient([])

        expect(METADATA_STALE_TIME).toBe(30 * 60_000)
        for (const options of [
            programsQuery(client, ['a']),
            trackedEntityTypeQuery(client, 't'),
            relationshipTypesQuery(client, ['a']),
            userScopesQuery(client),
            orgUnitPathsQuery(client, ['a']),
        ]) {
            expect(options.staleTime).toBe(METADATA_STALE_TIME)
        }
    })

    it('tracker queries set no staleTime', () => {
        const client = recordingClient([])

        for (const options of [
            personQuery(client, 'p'),
            relationshipsQuery(client, 'p'),
        ]) {
            expect(options).not.toHaveProperty('staleTime')
            expect(options).not.toHaveProperty('refetchOnWindowFocus')
        }
    })

    it('query keys match the key factory', () => {
        const client = recordingClient([])

        expect(personQuery(client, 'p').queryKey).toEqual(
            trackedEntityRecordKeys.person('p')
        )
        expect(programsQuery(client, ['b', 'a']).queryKey).toEqual(
            trackedEntityRecordKeys.programs(['a', 'b'])
        )
    })

    it('sends the request with the schema and the abort signal', async () => {
        const calls: RecordedCall[] = []

        await clientFor().fetchQuery(personQuery(recordingClient(calls), 'abc'))

        expect(calls).toHaveLength(1)
        expect(calls[0].request).toEqual(personRequest('abc'))
        expect(calls[0].signal).toBeInstanceOf(AbortSignal)
    })

    it('asks for ids in sorted order, however they arrive', async () => {
        const calls: RecordedCall[] = []

        await clientFor().fetchQuery(
            programsQuery(recordingClient(calls), ['c', 'a', 'b'])
        )

        expect(calls[0].request).toEqual(programsRequest(['a', 'b', 'c']))
    })

    it('throws the error of a failed result so TanStack sees a rejection', async () => {
        const error = new RecordRequestError('http', 'Not Found', {
            status: 404,
        })

        await expect(
            clientFor().fetchQuery({
                ...relationshipsQuery(failingClient(error), 'p'),
                retry: false,
            })
        ).rejects.toBe(error)
    })

    it('unwraps ok results to their value', async () => {
        const data = await clientFor().fetchQuery(
            userScopesQuery(recordingClient([]))
        )

        expect(data).toEqual({ answered: 'me' })
    })
})

describe('retryRecordRequest', () => {
    const http = (status: number) =>
        new RecordRequestError('http', 'failed', { status })

    it('does not retry 404 or invalid-response and retries 503 twice', () => {
        expect(retryRecordRequest(0, http(404))).toBe(false)
        expect(retryRecordRequest(0, http(400))).toBe(false)
        expect(
            retryRecordRequest(
                0,
                new RecordRequestError('invalid-response', 'x')
            )
        ).toBe(false)

        expect(retryRecordRequest(0, http(503))).toBe(true)
        expect(retryRecordRequest(1, http(503))).toBe(true)
        expect(retryRecordRequest(2, http(503))).toBe(false)
    })

    it('retries network failures and unknown errors up to twice', () => {
        const network = new RecordRequestError('network', 'offline')

        expect(retryRecordRequest(0, network)).toBe(true)
        expect(retryRecordRequest(1, network)).toBe(true)
        expect(retryRecordRequest(2, network)).toBe(false)
        expect(retryRecordRequest(0, new Error('boom'))).toBe(true)
        expect(retryRecordRequest(2, new Error('boom'))).toBe(false)
    })
})

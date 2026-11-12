import { FetchError } from '@dhis2/app-runtime'
import { renderHook } from 'vitest-browser-react'
import { z } from 'zod'
import {
    createWrapper,
    requestFailure,
    serve,
    type HeaderRequest,
    type ResponseBody,
} from '../__tests__/headerTestSupport'
import organisationUnit from './__fixtures__/organisationUnit.json'
import childProgram from './__fixtures__/program.child.json'
import rmnchPerson from './__fixtures__/trackedEntity.rmnch.json'
import personType from './__fixtures__/trackedEntityType.person.json'
import {
    isForbidden,
    shouldRetryRequest,
    useAttributeMetadata,
    useOrgUnitName,
    useTrackedEntity,
} from './queries'

/** A server that answers each request in turn with the next of `answers`, then the last again. An Error is thrown. */
const serverAnswering = (...answers: (ResponseBody | Error)[]) => {
    const requests: HeaderRequest[] = []
    const data = serve((request) => {
        const answer = answers[Math.min(requests.length, answers.length - 1)]
        requests.push(request)
        if (answer instanceof Error) {
            throw answer
        }
        return answer ?? {}
    })
    return { wrapper: createWrapper(data), requests }
}

const enrollmentOf = (
    enrollment: string,
    status: string,
    enrolledAt: string,
    program = 'p1'
) => ({ enrollment, program, status, enrolledAt, orgUnit: 'ou1' })

const personWith = (
    enrollments: Record<string, string>[],
    programOwners: Record<string, string>[] = []
) => ({
    trackedEntity: 'te1',
    trackedEntityType: 'tt1',
    attributes: [{ attribute: 'a1', value: 'x' }],
    enrollments,
    programOwners,
})

const IN_PROGRAM = { trackedEntity: 'te1', program: 'p1' }

/** The record the hook loads from a server that answers with `person`. */
const loadedFrom = async (
    person: ResponseBody,
    subject: { trackedEntity: string; program?: string } = IN_PROGRAM
) => {
    const { wrapper } = serverAnswering(person)
    const { result } = await renderHook(() => useTrackedEntity(subject), {
        wrapper,
    })
    await expect.poll(() => result.current.isSuccess).toBe(true)
    return result.current.data
}

describe('shouldRetryRequest', () => {
    it.each([
        { name: 'a server error', error: requestFailure(500), retried: true },
        { name: 'a client error', error: requestFailure(400), retried: false },
        {
            name: 'a network failure',
            error: new FetchError({ type: 'network', message: 'offline' }),
            retried: true,
        },
        { name: 'no access', error: requestFailure(403), retried: false },
        {
            name: 'a response that fails the schema',
            error: new z.ZodError([]),
            retried: false,
        },
    ])('$name: retried is $retried', ({ error, retried }) => {
        expect(shouldRetryRequest(0, error)).toBe(retried)
        expect(shouldRetryRequest(1, error)).toBe(retried)
        expect(shouldRetryRequest(2, error)).toBe(false)
    })
})

describe('isForbidden', () => {
    it('is true for a 403 as app-runtime throws it', () => {
        expect(isForbidden(requestFailure(403))).toBe(true)
    })

    it('is false for other failures, and never reads the message', () => {
        expect(isForbidden(requestFailure(500))).toBe(false)
        expect(isForbidden(new Error('403 Forbidden'))).toBe(false)
        expect(
            isForbidden(
                new FetchError({ type: 'unknown', message: '403 Forbidden' })
            )
        ).toBe(false)
    })

    it("is false for app-runtime's other access errors", () => {
        expect(
            isForbidden(
                new FetchError({
                    type: 'access',
                    message: 'Conflict',
                    details: { httpStatusCode: 409 },
                })
            )
        ).toBe(false)
    })
})

describe('useTrackedEntity', () => {
    it('asks for the person with the program only when given', async () => {
        const withProgram = serverAnswering(personWith([]))
        const without = serverAnswering(personWith([]))

        const inProgram = await renderHook(() => useTrackedEntity(IN_PROGRAM), {
            wrapper: withProgram.wrapper,
        })
        const alone = await renderHook(
            () => useTrackedEntity({ trackedEntity: 'te1' }),
            { wrapper: without.wrapper }
        )
        await expect.poll(() => inProgram.result.current.isSuccess).toBe(true)
        await expect.poll(() => alone.result.current.isSuccess).toBe(true)

        expect(withProgram.requests[0]).toMatchObject({
            resource: 'tracker/trackedEntities',
            id: 'te1',
            params: { program: 'p1' },
        })
        expect(without.requests[0]?.params).not.toHaveProperty('program')
        expect(without.requests[0]?.params?.fields).toContain(
            'programOwners[orgUnit,program]'
        )
    })

    it('asks for nothing without a tracked entity id', async () => {
        const { wrapper, requests } = serverAnswering(personWith([]))

        const { result } = await renderHook(
            () => useTrackedEntity({ trackedEntity: '', program: 'p1' }),
            { wrapper }
        )

        expect(result.current.isPending).toBe(true)
        expect(requests).toHaveLength(0)
    })

    it('maps the RMNCH fixture', async () => {
        const person = await loadedFrom(rmnchPerson, {
            trackedEntity: 'k4ODejBytgv',
            program: 'WSGAb5XwJ3Y',
        })

        expect(person).toMatchObject({
            id: 'k4ODejBytgv',
            type: 'nEenWmSyUEp',
            inactive: false,
            potentialDuplicate: false,
            ownerOrgUnit: 'DiszpKrYNg8',
            enrollment: { enrollment: 'iNEq9d22Nyp', status: 'ACTIVE' },
        })
        expect(person?.values.get('w75KJ2mc4zz')).toBe('Linda')
    })

    it('keeps only the enrollments and owner of that program', async () => {
        const person = await loadedFrom(
            personWith(
                [enrollmentOf('other', 'ACTIVE', '2026-01-01', 'p2')],
                [{ program: 'p2', orgUnit: 'ouOther' }]
            )
        )

        expect(person?.id).toBe('te1')
        expect(person?.enrollment).toBeUndefined()
        expect(person?.ownerOrgUnit).toBeUndefined()
    })

    it('takes no enrollment or owner without a program', async () => {
        const person = await loadedFrom(
            personWith(
                [enrollmentOf('e1', 'ACTIVE', '2026-01-01')],
                [{ program: 'p1', orgUnit: 'ou1' }]
            ),
            { trackedEntity: 'te1' }
        )

        expect(person?.id).toBe('te1')
        expect(person?.enrollment).toBeUndefined()
        expect(person?.ownerOrgUnit).toBeUndefined()
    })

    it('picks the ACTIVE enrollment over a later completed one', async () => {
        const person = await loadedFrom(
            personWith([
                enrollmentOf('old', 'COMPLETED', '2024-03-01T00:00:00.000'),
                enrollmentOf('current', 'ACTIVE', '2025-03-01T00:00:00.000'),
                enrollmentOf('newest', 'COMPLETED', '2026-03-01T00:00:00.000'),
            ])
        )

        expect(person?.enrollment?.enrollment).toBe('current')
    })

    it('picks the later enrolledAt when none is ACTIVE', async () => {
        const person = await loadedFrom(
            personWith([
                enrollmentOf('later', 'COMPLETED', '2025-03-01T00:00:00.000'),
                enrollmentOf('earlier', 'COMPLETED', '2024-03-01T00:00:00.000'),
            ])
        )

        expect(person?.enrollment?.enrollment).toBe('later')
    })

    it('a person not enrolled in the program (404) is asked for again without it, with no enrollment or owner', async () => {
        // The person without the program still lists every enrollment and owner it has.
        const { wrapper, requests } = serverAnswering(
            requestFailure(404),
            personWith(
                [enrollmentOf('e1', 'ACTIVE', '2026-01-01')],
                [{ program: 'p1', orgUnit: 'ou1' }]
            )
        )

        const { result } = await renderHook(
            () => useTrackedEntity(IN_PROGRAM),
            { wrapper }
        )
        await expect.poll(() => result.current.isSuccess).toBe(true)

        expect(requests).toHaveLength(2)
        expect(requests[0]?.params).toHaveProperty('program', 'p1')
        expect(requests[1]?.params).not.toHaveProperty('program')
        const person = result.current.data
        expect(person?.values.get('a1')).toBe('x')
        expect(person?.enrollment).toBeUndefined()
        expect(person?.ownerOrgUnit).toBeUndefined()
    })

    it('a refused request (403) is never asked again, with or without the program', async () => {
        const { wrapper, requests } = serverAnswering(requestFailure(403))

        const { result } = await renderHook(
            () => useTrackedEntity(IN_PROGRAM),
            { wrapper }
        )
        await expect.poll(() => result.current.isError).toBe(true)

        expect(requests).toHaveLength(1)
        expect(result.current.error).toBeInstanceOf(FetchError)
        expect(result.current.error?.message).toBe('HTTP 403')
    })

    it('a server failure (500) is retried twice, never without the program', async () => {
        const { wrapper, requests } = serverAnswering(requestFailure(500))

        const { result } = await renderHook(
            () => useTrackedEntity(IN_PROGRAM),
            { wrapper }
        )
        await expect.poll(() => result.current.isError).toBe(true)

        expect(requests).toHaveLength(3)
        expect(requests.map(({ params }) => params?.program)).toEqual([
            'p1',
            'p1',
            'p1',
        ])
    })

    it('a client error (400) is asked for once', async () => {
        const { wrapper, requests } = serverAnswering(requestFailure(400))

        const { result } = await renderHook(
            () => useTrackedEntity(IN_PROGRAM),
            { wrapper }
        )
        await expect.poll(() => result.current.isError).toBe(true)

        expect(requests).toHaveLength(1)
    })

    it('a person not found without a program is an error, asked for once', async () => {
        const { wrapper, requests } = serverAnswering(requestFailure(404))

        const { result } = await renderHook(
            () => useTrackedEntity({ trackedEntity: 'te1' }),
            { wrapper }
        )
        await expect.poll(() => result.current.isError).toBe(true)

        expect(requests).toHaveLength(1)
    })

    it('a response that fails the schema is an error, asked for once', async () => {
        const { wrapper, requests } = serverAnswering({ odd: true })

        const { result } = await renderHook(
            () => useTrackedEntity(IN_PROGRAM),
            { wrapper }
        )
        await expect.poll(() => result.current.isError).toBe(true)

        expect(requests).toHaveLength(1)
        expect(result.current.error).toBeInstanceOf(z.ZodError)
    })
})

describe('useAttributeMetadata', () => {
    it('reads the program with the display name, dates and attributes', async () => {
        const { wrapper, requests } = serverAnswering(childProgram)

        const { result } = await renderHook(
            () => useAttributeMetadata({ program: 'IpHINAT79UW' }),
            { wrapper }
        )
        await expect.poll(() => result.current.isSuccess).toBe(true)

        expect(requests[0]).toMatchObject({
            resource: 'programs',
            id: 'IpHINAT79UW',
        })
        expect(requests[0]?.params?.fields).toBe(
            'displayName,accessLevel,incidentDateLabel,enrollmentDateLabel,trackedEntityType[displayName],programTrackedEntityAttributes[displayInList,sortOrder,trackedEntityAttribute[id,displayFormName,valueType,optionSet[options[code,displayName]]]]'
        )
        expect(result.current.data?.programName).toBe('Child Programme')
    })

    it("reads the person type's attributes without a program", async () => {
        const { wrapper, requests } = serverAnswering(personType)

        const { result } = await renderHook(
            () => useAttributeMetadata({ trackedEntityType: 'nEenWmSyUEp' }),
            { wrapper }
        )
        await expect.poll(() => result.current.isSuccess).toBe(true)

        expect(requests[0]).toMatchObject({
            resource: 'trackedEntityTypes',
            id: 'nEenWmSyUEp',
        })
        expect(result.current.data?.typeName).toBe('Person')
    })

    it('asks for nothing until it knows whose attributes', async () => {
        const { wrapper, requests } = serverAnswering(personType)

        const { result } = await renderHook(
            () => useAttributeMetadata(undefined),
            { wrapper }
        )

        expect(result.current.isPending).toBe(true)
        expect(requests).toHaveLength(0)
    })
})

describe('useOrgUnitName', () => {
    it('reads the display name', async () => {
        const { wrapper, requests } = serverAnswering(organisationUnit)

        const { result } = await renderHook(
            () => useOrgUnitName('DiszpKrYNg8'),
            { wrapper }
        )
        await expect.poll(() => result.current.isSuccess).toBe(true)

        expect(requests[0]).toMatchObject({
            resource: 'organisationUnits',
            id: 'DiszpKrYNg8',
            params: { fields: 'displayName' },
        })
        expect(result.current.data).toBe('Ngelehun CHC')
    })

    it('asks for nothing without an organisation unit', async () => {
        const { wrapper, requests } = serverAnswering(organisationUnit)

        const { result } = await renderHook(() => useOrgUnitName(undefined), {
            wrapper,
        })

        expect(result.current.isPending).toBe(true)
        expect(requests).toHaveLength(0)
    })
})

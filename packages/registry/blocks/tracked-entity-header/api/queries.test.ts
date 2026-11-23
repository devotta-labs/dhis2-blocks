import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import { Result } from 'better-result'
import { fixture } from '../test/header.fixture'
import {
    createTrackedEntityHeaderResourceClient,
    type DataEngineValue,
} from './client'
import {
    fetchAttributeMetadata,
    fetchOrgUnitName,
    fetchTrackedEntity,
} from './queries'

const servePerson = async (respond: (request: URL) => Response) =>
    serveHeaderApi('/api/tracker/trackedEntities/te1', respond)

const serveHeaderApi = async (
    path: string,
    respond: (request: URL) => Response
) => {
    const requests: URL[] = []
    const { engine } = await openDhis2TestServer((url) => {
        if (url.pathname === path) {
            requests.push(url)
            return respond(url)
        }
        return undefined
    })
    return { client: createTrackedEntityHeaderResourceClient(engine), requests }
}

const engineReturning = (path: string, response: DataEngineValue) =>
    serveHeaderApi(path, () => Response.json(response))

const dhis2Error = (httpStatusCode: number, message: string) =>
    Response.json({ httpStatusCode, message }, { status: httpStatusCode })

const ok = <T>(result: Result<T, Error>) => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
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

describe('fetchTrackedEntity', () => {
    it('asks for the person with the program only when given', async () => {
        const withProgram = await engineReturning(
            '/api/tracker/trackedEntities/te1',
            personWith([])
        )
        const without = await engineReturning(
            '/api/tracker/trackedEntities/te1',
            personWith([])
        )

        await fetchTrackedEntity(withProgram.client, {
            trackedEntity: 'te1',
            program: 'p1',
        })
        await fetchTrackedEntity(without.client, { trackedEntity: 'te1' })

        expect(withProgram.requests).toHaveLength(1)
        expect(withProgram.requests[0].searchParams.get('program')).toBe('p1')
        expect(without.requests).toHaveLength(1)
        expect(without.requests[0].searchParams.has('program')).toBe(false)
        expect(without.requests[0].searchParams.get('fields')).toContain(
            'programOwners[orgUnit,program]'
        )
    })

    it('maps the RMNCH fixture', async () => {
        const { client } = await engineReturning(
            '/api/tracker/trackedEntities/k4ODejBytgv',
            fixture('trackedEntity.rmnch.json')
        )

        const person = ok(
            await fetchTrackedEntity(client, {
                trackedEntity: 'k4ODejBytgv',
                program: 'WSGAb5XwJ3Y',
            })
        )

        expect(person).toMatchObject({
            id: 'k4ODejBytgv',
            type: 'nEenWmSyUEp',
            inactive: false,
            potentialDuplicate: false,
            ownerOrgUnit: 'DiszpKrYNg8',
            enrollment: { enrollment: 'iNEq9d22Nyp', status: 'ACTIVE' },
        })
        expect(person.values.get('w75KJ2mc4zz')).toBe('Linda')
    })

    it('keeps only the enrollments and owner of that program', async () => {
        const { client } = await engineReturning(
            '/api/tracker/trackedEntities/te1',
            personWith(
                [enrollmentOf('other', 'ACTIVE', '2026-01-01', 'p2')],
                [{ program: 'p2', orgUnit: 'ouOther' }]
            )
        )

        const person = ok(
            await fetchTrackedEntity(client, {
                trackedEntity: 'te1',
                program: 'p1',
            })
        )

        expect(person.enrollment).toBeUndefined()
        expect(person.ownerOrgUnit).toBeUndefined()
    })

    it('takes no enrollment or owner without a program', async () => {
        const { client } = await engineReturning(
            '/api/tracker/trackedEntities/te1',
            personWith(
                [enrollmentOf('e1', 'ACTIVE', '2026-01-01')],
                [{ program: 'p1', orgUnit: 'ou1' }]
            )
        )

        const person = ok(
            await fetchTrackedEntity(client, { trackedEntity: 'te1' })
        )

        expect(person.enrollment).toBeUndefined()
        expect(person.ownerOrgUnit).toBeUndefined()
    })

    it('picks the ACTIVE enrollment over a later completed one', async () => {
        const { client } = await engineReturning(
            '/api/tracker/trackedEntities/te1',
            personWith([
                enrollmentOf('old', 'COMPLETED', '2024-03-01T00:00:00.000'),
                enrollmentOf('current', 'ACTIVE', '2025-03-01T00:00:00.000'),
                enrollmentOf('newest', 'COMPLETED', '2026-03-01T00:00:00.000'),
            ])
        )

        const person = ok(
            await fetchTrackedEntity(client, {
                trackedEntity: 'te1',
                program: 'p1',
            })
        )

        expect(person.enrollment?.enrollment).toBe('current')
    })

    it('picks the later enrolledAt when none is ACTIVE', async () => {
        const { client } = await engineReturning(
            '/api/tracker/trackedEntities/te1',
            personWith([
                enrollmentOf('later', 'COMPLETED', '2025-03-01T00:00:00.000'),
                enrollmentOf('earlier', 'COMPLETED', '2024-03-01T00:00:00.000'),
            ])
        )

        const person = ok(
            await fetchTrackedEntity(client, {
                trackedEntity: 'te1',
                program: 'p1',
            })
        )

        expect(person.enrollment?.enrollment).toBe('later')
    })

    it('a person not enrolled in the program (404) is asked for again without it, with no enrollment or owner', async () => {
        const { client, requests } = await servePerson((url) =>
            url.searchParams.has('program')
                ? dhis2Error(404, 'Not found')
                : Response.json(
                      personWith(
                          [enrollmentOf('e1', 'ACTIVE', '2026-01-01')],
                          [{ program: 'p1', orgUnit: 'ou1' }]
                      )
                  )
        )

        const person = ok(
            await fetchTrackedEntity(client, {
                trackedEntity: 'te1',
                program: 'p1',
            })
        )

        expect(requests).toHaveLength(2)
        expect(requests[0].searchParams.get('program')).toBe('p1')
        expect(requests[1].searchParams.has('program')).toBe(false)
        expect(person.values.get('a1')).toBe('x')
        expect(person.enrollment).toBeUndefined()
        expect(person.ownerOrgUnit).toBeUndefined()
    })

    it.each([403, 500])(
        'never asks again without the program after a %i',
        async (httpStatusCode) => {
            const { client, requests } = await servePerson(() =>
                dhis2Error(httpStatusCode, 'no')
            )

            const result = await fetchTrackedEntity(client, {
                trackedEntity: 'te1',
                program: 'p1',
            })

            expect(Result.isError(result)).toBe(true)
            expect(requests).toHaveLength(1)
        }
    )

    it('a person not found without a program is an error, asked for once', async () => {
        const { client, requests } = await servePerson(() =>
            dhis2Error(404, 'Not found')
        )

        const result = await fetchTrackedEntity(client, {
            trackedEntity: 'te1',
        })

        expect(Result.isError(result)).toBe(true)
        expect(requests).toHaveLength(1)
    })

    it('returns an error result on HTTP failure', async () => {
        const { client } = await servePerson(() => dhis2Error(403, 'Forbidden'))

        const result = await fetchTrackedEntity(client, {
            trackedEntity: 'te1',
        })

        expect(Result.isError(result) && result.error.message).toContain(
            'Forbidden'
        )
    })
})

describe('fetchAttributeMetadata', () => {
    it('reads the program with the display name, dates and attributes', async () => {
        const { client, requests } = await engineReturning(
            '/api/42/programs/IpHINAT79UW',
            fixture('program.child.json')
        )

        const metadata = ok(
            await fetchAttributeMetadata(client, { program: 'IpHINAT79UW' })
        )

        expect(requests).toHaveLength(1)
        expect(requests[0].searchParams.get('fields')).toBe(
            'displayName,accessLevel,incidentDateLabel,enrollmentDateLabel,trackedEntityType[displayName],programTrackedEntityAttributes[displayInList,sortOrder,trackedEntityAttribute[id,displayFormName,valueType,optionSet[options[code,displayName]]]]'
        )
        expect(metadata.programName).toBe('Child Programme')
    })

    it("reads the person type's attributes without a program", async () => {
        const { client, requests } = await engineReturning(
            '/api/42/trackedEntityTypes/nEenWmSyUEp',
            fixture('trackedEntityType.person.json')
        )

        const metadata = ok(
            await fetchAttributeMetadata(client, {
                trackedEntityType: 'nEenWmSyUEp',
            })
        )

        expect(requests).toHaveLength(1)
        expect(metadata.typeName).toBe('Person')
    })
})

describe('fetchOrgUnitName', () => {
    it('reads the display name', async () => {
        const { client, requests } = await engineReturning(
            '/api/42/organisationUnits/DiszpKrYNg8',
            fixture('organisationUnit.json')
        )

        const name = ok(await fetchOrgUnitName(client, 'DiszpKrYNg8'))

        expect(requests).toHaveLength(1)
        expect(requests[0].searchParams.get('fields')).toBe('displayName')
        expect(name.length).toBeGreaterThan(0)
    })
})

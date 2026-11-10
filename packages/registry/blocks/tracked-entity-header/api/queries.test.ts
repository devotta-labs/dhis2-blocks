import { Result } from 'better-result'
import { fixture } from '../__tests__/fixtures'
import {
    createTrackedEntityHeaderResourceClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    fetchAttributeMetadata,
    fetchOrgUnitName,
    fetchTrackedEntity,
} from './queries'

const engineReturning = (response: DataEngineValue) => {
    const query = vi
        .fn<DataEngineLike['query']>()
        .mockResolvedValue({ trackedEntityHeaderResource: response })
    return {
        client: createTrackedEntityHeaderResourceClient({ query }),
        request: () => Object.values(query.mock.calls[0]?.[0] ?? {})[0],
    }
}

const ok = <T>(result: Result<T, Error>): T => {
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
        const withProgram = engineReturning(personWith([]))
        const without = engineReturning(personWith([]))

        await fetchTrackedEntity(withProgram.client, {
            trackedEntity: 'te1',
            program: 'p1',
        })
        await fetchTrackedEntity(without.client, { trackedEntity: 'te1' })

        expect(withProgram.request()).toMatchObject({
            resource: 'tracker/trackedEntities',
            id: 'te1',
            params: { program: 'p1' },
        })
        expect(without.request()?.params).not.toHaveProperty('program')
        expect(without.request()?.params?.fields).toContain(
            'programOwners[orgUnit,program]'
        )
    })

    it('maps the RMNCH fixture', async () => {
        const { client } = engineReturning(fixture('trackedEntity.rmnch.json'))

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
        const { client } = engineReturning(
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
        const { client } = engineReturning(
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
        const { client } = engineReturning(
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
        const { client } = engineReturning(
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

    it('returns an error result on HTTP failure', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockRejectedValue(new Error('Forbidden'))

        const result = await fetchTrackedEntity(
            createTrackedEntityHeaderResourceClient({ query }),
            { trackedEntity: 'te1' }
        )

        expect(Result.isError(result) && result.error.message).toContain(
            'Forbidden'
        )
    })
})

describe('fetchAttributeMetadata', () => {
    it('reads the program with the display name, dates and attributes', async () => {
        const { client, request } = engineReturning(
            fixture('program.child.json')
        )

        const metadata = ok(
            await fetchAttributeMetadata(client, { program: 'IpHINAT79UW' })
        )

        expect(request()).toMatchObject({
            resource: 'programs',
            id: 'IpHINAT79UW',
        })
        expect(request()?.params?.fields).toBe(
            'displayName,accessLevel,incidentDateLabel,enrollmentDateLabel,trackedEntityType[displayName],programTrackedEntityAttributes[displayInList,sortOrder,trackedEntityAttribute[id,displayFormName,valueType,optionSet[options[code,displayName]]]]'
        )
        expect(metadata.programName).toBe('Child Programme')
    })

    it("reads the person type's attributes without a program", async () => {
        const { client, request } = engineReturning(
            fixture('trackedEntityType.person.json')
        )

        const metadata = ok(
            await fetchAttributeMetadata(client, {
                trackedEntityType: 'nEenWmSyUEp',
            })
        )

        expect(request()).toMatchObject({
            resource: 'trackedEntityTypes',
            id: 'nEenWmSyUEp',
        })
        expect(metadata.typeName).toBe('Person')
    })
})

describe('fetchOrgUnitName', () => {
    it('reads the display name', async () => {
        const { client, request } = engineReturning(
            fixture('organisationUnit.json')
        )

        const name = ok(await fetchOrgUnitName(client, 'DiszpKrYNg8'))

        expect(request()).toMatchObject({
            resource: 'organisationUnits',
            id: 'DiszpKrYNg8',
            params: { fields: 'displayName' },
        })
        expect(name.length).toBeGreaterThan(0)
    })
})

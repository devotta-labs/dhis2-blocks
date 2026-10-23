import { FetchError } from '@dhis2/app-runtime'
import { renderHook } from 'vitest-browser-react'
import {
    ProfileWidgetRequestError,
    TrackedEntityNotAccessibleError,
} from '../../errors'
import type { UseTrackedEntityProfileOptions } from '../../types'
import { useTrackedEntityProfile } from '../useTrackedEntityProfile'
import {
    ATTRIBUTES,
    CHILD_PROGRAM_ID,
    ORG_UNIT_ID,
    PERSON_TYPE_ID,
    programJson,
    recordJson,
    TRACKED_ENTITY_ID,
    trackedEntityTypeJson,
} from './fixtures'
import {
    createDeferred,
    createHarness,
    toJson,
    type Responder,
} from './harness'

const renderProfile = async (
    options: Partial<UseTrackedEntityProfileOptions> = {},
    overrides: Map<string, Responder> = new Map()
) => {
    const harness = createHarness(overrides)
    const hook = await renderHook(
        () =>
            useTrackedEntityProfile({
                trackedEntityId: TRACKED_ENTITY_ID,
                programId: CHILD_PROGRAM_ID,
                ...options,
            }),
        { wrapper: harness.wrapper }
    )
    return { ...harness, hook, result: hook.result }
}

const notFound = () =>
    new FetchError({
        type: 'unknown',
        message: 'Not found',
        details: { httpStatusCode: 404, message: 'Not found' },
    })

describe('useTrackedEntityProfile', () => {
    it('loads a profile in program mode with formatted default rows', async () => {
        const { result, requests } = await renderProfile()

        await expect.poll(() => result.current.data).toBeDefined()
        const { data, error, isPending } = result.current
        expect(error).toBeNull()
        expect(isPending).toBe(false)

        expect(data?.title).toBe('Person profile')
        expect(data?.displayName).toBe('John Kelly')
        expect(data?.labels).toEqual({
            attributes: 'attributes',
            enrollments: 'enrollments',
            events: 'events',
        })
        expect(data?.trackedEntity).toEqual({
            id: TRACKED_ENTITY_ID,
            programId: CHILD_PROGRAM_ID,
            trackedEntityTypeId: PERSON_TYPE_ID,
            trackedEntityTypeName: 'Person',
            orgUnitId: ORG_UNIT_ID,
            inactive: false,
        })
        expect(data?.permissions).toEqual({
            changelog: { status: 'available' },
            setInactive: { status: 'available' },
            delete: { status: 'available' },
        })

        // Program displayInList rows in program order, then TET-only rows.
        expect(data?.fields.map((field) => [field.label, field.value])).toEqual(
            [
                ['First name', { kind: 'text', text: 'John' }],
                ['Gender', { kind: 'text', text: 'Male' }],
                ['Date of birth', { kind: 'text', text: '2020-03-01' }],
                [
                    'Photo',
                    {
                        kind: 'image',
                        href: `https://dhis2.test/api/43/tracker/trackedEntities/${TRACKED_ENTITY_ID}/attributes/${ATTRIBUTES.photo.id}/image?program=${CHILD_PROGRAM_ID}`,
                        previewHref: `https://dhis2.test/api/43/tracker/trackedEntities/${TRACKED_ENTITY_ID}/attributes/${ATTRIBUTES.photo.id}/image?program=${CHILD_PROGRAM_ID}&dimension=small`,
                        alt: 'Photo',
                    },
                ],
                [
                    'Consent form',
                    {
                        kind: 'file',
                        name: 'consent.pdf',
                        href: `https://dhis2.test/api/43/tracker/trackedEntities/${TRACKED_ENTITY_ID}/attributes/${ATTRIBUTES.document.id}/file?program=${CHILD_PROGRAM_ID}`,
                    },
                ],
                [
                    'Home facility',
                    {
                        kind: 'organisationUnit',
                        name: 'Ngelehun CHC',
                        path: ['Sierra Leone', 'Bo', 'Badjia'],
                    },
                ],
                ['Address', { kind: 'text', text: 'Main street 2' }],
            ]
        )
        expect(data?.attributes.map((attribute) => attribute.id)).toEqual([
            ATTRIBUTES.lastName.id,
            ATTRIBUTES.firstName.id,
            ATTRIBUTES.gender.id,
            ATTRIBUTES.birthDate.id,
            ATTRIBUTES.photo.id,
            ATTRIBUTES.document.id,
            ATTRIBUTES.homeFacility.id,
            ATTRIBUTES.uniqueId.id,
            ATTRIBUTES.address.id,
        ])

        expect(
            requests.find(
                (request) => request.resource === 'tracker/trackedEntities'
            )
        ).toMatchObject({
            id: TRACKED_ENTITY_ID,
            params: { program: CHILD_PROGRAM_ID },
        })
        expect(
            requests.find((request) => request.resource === 'programs')?.params
                .fields
        ).toContain('enableChangeLog')
        expect(
            requests.find((request) => request.resource === 'programs')?.params
                .fields
        ).toContain('displayEnrollmentsLabel')
        expect(
            requests.some(
                (request) => request.resource === 'trackedEntityTypes'
            )
        ).toBe(false)
    })

    it('requests the program and the tracked entity in parallel', async () => {
        const record = createDeferred()
        const { result, resourcesRequested } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'tracker/trackedEntities',
                    async () => {
                        await record.promise
                        return toJson(recordJson())
                    },
                ],
            ])
        )

        await expect
            .poll(resourcesRequested)
            .toEqual(
                expect.arrayContaining([
                    'tracker/trackedEntities',
                    'programs',
                    'me',
                    'system/info',
                ])
            )
        expect(result.current.isPending).toBe(true)
        record.resolve()
        await expect.poll(() => result.current.data).toBeDefined()
    })

    it('loads the tracked entity type after the tracked entity without a program', async () => {
        const record = createDeferred()
        const { result, requests, resourcesRequested } = await renderProfile(
            { programId: undefined },
            new Map<string, Responder>([
                [
                    'tracker/trackedEntities',
                    async () => {
                        await record.promise
                        return toJson(recordJson())
                    },
                ],
            ])
        )

        await expect
            .poll(resourcesRequested)
            .toContain('tracker/trackedEntities')
        expect(resourcesRequested()).not.toContain('trackedEntityTypes')
        expect(resourcesRequested()).not.toContain('programs')

        record.resolve()
        await expect.poll(() => result.current.data).toBeDefined()

        expect(
            requests.find(
                (request) => request.resource === 'trackedEntityTypes'
            )
        ).toMatchObject({ id: PERSON_TYPE_ID })
        expect(
            requests.find(
                (request) => request.resource === 'tracker/trackedEntities'
            )?.params
        ).not.toHaveProperty('program')

        const { data } = result.current
        expect(data?.trackedEntity.programId).toBeNull()
        expect(data?.labels.attributes).toBe('attributes')
        expect(data?.fields.map((field) => field.label)).toEqual([
            'First name',
            'Last name',
            'Address',
        ])
        expect(
            data?.attributes.every(
                (attribute) => attribute.origin === 'trackedEntityType'
            )
        ).toBe(true)
    })

    it('treats an empty programId as no program', async () => {
        const { result, resourcesRequested } = await renderProfile({
            programId: '',
        })
        await expect.poll(() => result.current.data).toBeDefined()
        expect(result.current.data?.trackedEntity.programId).toBeNull()
        expect(resourcesRequested()).not.toContain('programs')
    })

    it('stays pending until the org-unit and file lookups resolve', async () => {
        const lookup = createDeferred()
        const { result, resourcesRequested } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'organisationUnits',
                    async () => {
                        await lookup.promise
                        return {
                            organisationUnits: [
                                {
                                    id: ORG_UNIT_ID,
                                    displayName: 'Ngelehun CHC',
                                    ancestors: [],
                                },
                            ],
                        }
                    },
                ],
            ])
        )

        await expect.poll(resourcesRequested).toContain('organisationUnits')
        await expect.poll(resourcesRequested).toContain('fileResources')
        expect(result.current.isPending).toBe(true)
        expect(result.current.data).toBeUndefined()

        lookup.resolve()
        await expect.poll(() => result.current.data).toBeDefined()
        expect(
            result.current.data?.attributes.find(
                (attribute) => attribute.id === ATTRIBUTES.homeFacility.id
            )?.value
        ).toEqual({ kind: 'organisationUnit', name: 'Ngelehun CHC', path: [] })
    })

    it('maps a 404 on the tracked entity to TrackedEntityNotAccessibleError', async () => {
        const { result } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'tracker/trackedEntities',
                    () => {
                        throw notFound()
                    },
                ],
            ])
        )

        await expect.poll(() => result.current.error).not.toBeNull()
        const { error, isPending, data } = result.current
        expect(error).toBeInstanceOf(TrackedEntityNotAccessibleError)
        expect(error).toMatchObject({
            trackedEntityId: TRACKED_ENTITY_ID,
            programId: CHILD_PROGRAM_ID,
            httpStatus: 404,
        })
        expect(isPending).toBe(false)
        expect(data).toBeUndefined()
    })

    it('reports an entity of another type than the program as not accessible (2.41 answers 200)', async () => {
        const { result, resourcesRequested } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'tracker/trackedEntities',
                    () =>
                        toJson({
                            ...recordJson(),
                            trackedEntityType: 'OtherTet001',
                        }),
                ],
            ])
        )

        await expect.poll(() => result.current.error).not.toBeNull()
        const { error, isPending, data } = result.current
        expect(error).toBeInstanceOf(TrackedEntityNotAccessibleError)
        expect(error).toMatchObject({
            _tag: 'TrackedEntityNotAccessibleError',
            trackedEntityId: TRACKED_ENTITY_ID,
            programId: CHILD_PROGRAM_ID,
            httpStatus: 404,
        })
        expect(isPending).toBe(false)
        expect(data).toBeUndefined()
        // The wrong type's values are never looked up.
        expect(resourcesRequested()).not.toContain('organisationUnits')
        expect(resourcesRequested()).not.toContain('fileResources')
    })

    it('reports other failures as request errors with the operation', async () => {
        const { result } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'programs',
                    () => {
                        throw notFound()
                    },
                ],
            ])
        )

        await expect.poll(() => result.current.error).not.toBeNull()
        expect(result.current.error).toBeInstanceOf(ProfileWidgetRequestError)
        expect(result.current.error).toMatchObject({
            operation: 'Load program',
            httpStatus: 404,
        })
    })

    it('reports a failed lookup and recovers on refetch', async () => {
        let failing = true
        const { result } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'organisationUnits',
                    () => {
                        if (failing) {
                            throw new FetchError({
                                type: 'network',
                                message: 'Offline',
                            })
                        }
                        return { organisationUnits: [] }
                    },
                ],
            ])
        )

        await expect.poll(() => result.current.error).not.toBeNull()
        expect(result.current.error).toMatchObject({
            operation: 'Load organisation units',
        })

        failing = false
        result.current.refetch()
        await expect.poll(() => result.current.data).toBeDefined()
        expect(result.current.error).toBeNull()
        expect(
            result.current.data?.attributes.find(
                (attribute) => attribute.id === ATTRIBUTES.homeFacility.id
            )?.value
        ).toEqual({ kind: 'text', text: ORG_UNIT_ID })
    })

    it('resolves permissions from metadata, the record and authorities', async () => {
        const { result } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'programs',
                    () => toJson(programJson({ programWrite: false })),
                ],
                ['me', () => ({ authorities: [] })],
                [
                    'tracker/trackedEntities',
                    () => toJson(recordJson({ inactive: true })),
                ],
            ])
        )

        await expect.poll(() => result.current.data).toBeDefined()
        expect(result.current.data?.trackedEntity.inactive).toBe(true)
        expect(result.current.data?.permissions).toEqual({
            changelog: { status: 'unavailable' },
            setInactive: { status: 'available' },
            delete: { status: 'unavailable' },
        })
    })

    it('disables delete without the cascade-delete authority', async () => {
        const { result } = await renderProfile(
            { programId: undefined },
            new Map<string, Responder>([
                [
                    'trackedEntityTypes',
                    () =>
                        toJson(trackedEntityTypeJson({ displayName: 'Case' })),
                ],
                ['me', () => ({ authorities: ['F_TEI_DELETE'] })],
            ])
        )

        await expect.poll(() => result.current.data).toBeDefined()
        expect(result.current.data?.title).toBe('Case profile')
        expect(result.current.data?.permissions.delete).toEqual({
            status: 'disabled',
            reason: 'You do not have access to delete this Case',
        })
    })

    it('builds fields with selectFields from every attribute', async () => {
        const { result } = await renderProfile({
            selectFields: (attributes) =>
                attributes.filter((attribute) => attribute.unique),
        })

        await expect.poll(() => result.current.data).toBeDefined()
        expect(result.current.data?.fields).toEqual([
            expect.objectContaining({
                id: ATTRIBUTES.uniqueId.id,
                value: { kind: 'empty' },
            }),
        ])
    })

    it('refetches the tracked entity and reports isFetching', async () => {
        let firstName = 'John'
        let gate = Promise.resolve()
        const { result } = await renderProfile(
            {},
            new Map<string, Responder>([
                [
                    'tracker/trackedEntities',
                    async () => {
                        await gate
                        return toJson(
                            recordJson({
                                attributes: [
                                    {
                                        attribute: ATTRIBUTES.firstName.id,
                                        value: firstName,
                                    },
                                ],
                            })
                        )
                    },
                ],
            ])
        )

        await expect.poll(() => result.current.data?.displayName).toBe('John')
        expect(result.current.isFetching).toBe(false)

        const refetched = createDeferred()
        gate = refetched.promise
        firstName = 'Jane'
        result.current.refetch()
        await expect.poll(() => result.current.isFetching).toBe(true)
        // The previous profile stays on screen while it refetches.
        expect(result.current.data?.displayName).toBe('John')
        expect(result.current.isPending).toBe(false)

        refetched.resolve()
        await expect.poll(() => result.current.data?.displayName).toBe('Jane')
        expect(result.current.isFetching).toBe(false)
    })
})

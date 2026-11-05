import { describe, expect, it } from 'vitest'
import {
    MutationResponseSchema,
    ProgramStageWorkingListsResponseSchema,
    TrackedEntityInstanceFiltersResponseSchema,
} from '@/components/working-list/api/schemas'
import { createLabServer } from '../labServer'
import { generateWorld } from '../labData'
import { DEFAULT_CONFIG } from '../presets'

const server = () =>
    createLabServer(
        DEFAULT_CONFIG,
        generateWorld(DEFAULT_CONFIG.data, '2026-11-02')
    )
const owner = { read: true, update: true, delete: true, write: true }
const reader = { read: true, update: false, delete: false, write: false }
const ok = { httpStatus: 'OK', httpStatusCode: 200, status: 'OK', response: {} }

interface StageReference {
    programStage?: { id: string }
}

describe('raw saved-view wire answers', () => {
    it('seeds literal tracked-entity and stage resources without parsing their output', async () => {
        const answer = server()
        expect(
            await answer({
                resource: 'trackedEntityInstanceFilters',
                id: 'labViewWome',
            })
        ).toEqual({
            id: 'labViewWome',
            displayName: 'Women',
            sortOrder: 0,
            program: { id: 'labProgram1' },
            access: owner,
            entityQueryCriteria: {
                attributeValueFilters: [
                    { attribute: 'labSex00001', in: ['F'] },
                ],
            },
        })
        expect(
            await answer({
                resource: 'programStageWorkingLists',
                id: 'labViewVisi',
            })
        ).toEqual({
            id: 'labViewVisi',
            displayName: 'Follow-up visits',
            sortOrder: 5,
            program: { id: 'labProgram1' },
            programStage: { id: 'labStage001' },
            access: reader,
            programStageQueryCriteria: {},
        })
    })

    it.each([
        'trackedEntityInstanceFilters',
        'programStageWorkingLists',
    ] as const)(
        'creates, reads, updates, replaces and deletes %s with retained JSON extensions',
        async (resource) => {
            const answer = server()
            const stage =
                resource === 'programStageWorkingLists'
                    ? { programStage: 'labStage001' }
                    : {}
            const normalizedStage: StageReference = {}
            if (resource === 'programStageWorkingLists') {
                normalizedStage.programStage = { id: 'labStage001' }
            }
            const criteria =
                resource === 'programStageWorkingLists'
                    ? 'programStageQueryCriteria'
                    : 'entityQueryCriteria'
            const data = {
                name: 'My saved view',
                program: 'labProgram1',
                ...stage,
                [criteria]: {
                    order: 'enrolledAt:desc',
                    futureCriteria: { enabled: true },
                },
                publicAccess: 'r-------',
                userAccesses: [{ id: 'someone', access: 'rw------' }],
                futureField: { labels: ['retained'] },
                access: reader,
                id: 'cannotChoose',
            }
            expect(await answer({ resource, data }, 'create')).toEqual({
                ...ok,
                response: { uid: 'labNewVw001' },
            })
            const read = () => answer({ resource, id: 'labNewVw001' })
            expect(await read()).toEqual({
                ...data,
                id: 'labNewVw001',
                access: owner,
                displayName: 'My saved view',
                program: { id: 'labProgram1' },
                ...normalizedStage,
            })
            const replacement = {
                name: 'Changed',
                displayName: 'Explicit label',
                program: { id: 'labProgram1' },
                ...stage,
                [criteria]: {},
            }
            for (const type of ['update', 'replace'] as const) {
                expect(
                    await answer(
                        { resource, id: 'labNewVw001', data: replacement },
                        type
                    )
                ).toEqual({ ...ok, response: { uid: 'labNewVw001' } })
                expect(await read()).toEqual({
                    ...replacement,
                    id: 'labNewVw001',
                    access: owner,
                    ...normalizedStage,
                })
            }
            expect(
                await answer({ resource, id: 'labNewVw001' }, 'delete')
            ).toEqual(ok)
            await expect(read()).rejects.toMatchObject({
                details: { httpStatusCode: 404 },
            })
        }
    )

    it('preserves existing access, allocates across resources and resets storage with each server', async () => {
        const answer = server()
        expect(
            await answer(
                {
                    resource: 'programStageWorkingLists',
                    id: 'labViewVisi',
                    data: {
                        name: 'Renamed',
                        program: 'labProgram1',
                        programStage: 'labStage001',
                        access: owner,
                    },
                },
                'replace'
            )
        ).toEqual({ ...ok, response: { uid: 'labViewVisi' } })
        expect(
            await answer({
                resource: 'programStageWorkingLists',
                id: 'labViewVisi',
            })
        ).toMatchObject({ access: reader, displayName: 'Renamed' })
        await answer(
            {
                resource: 'trackedEntityInstanceFilters',
                data: { name: 'One', program: 'labProgram1' },
            },
            'create'
        )
        expect(
            await answer(
                {
                    resource: 'programStageWorkingLists',
                    data: {
                        name: 'Two',
                        program: 'labProgram1',
                        programStage: 'labStage001',
                    },
                },
                'create'
            )
        ).toEqual({ ...ok, response: { uid: 'labNewVw002' } })
        const restarted = server()
        await expect(
            restarted({
                resource: 'trackedEntityInstanceFilters',
                id: 'labNewVw001',
            })
        ).rejects.toMatchObject({ details: { httpStatusCode: 404 } })
        expect(
            await restarted({
                resource: 'programStageWorkingLists',
                id: 'labViewVisi',
            })
        ).toMatchObject({ displayName: 'Follow-up visits' })
    })

    it('keeps the fake’s missing-write acknowledgements distinct from not-found reads', async () => {
        const answer = server()
        for (const type of ['update', 'replace', 'delete'] as const) {
            expect(
                await answer(
                    { resource: 'trackedEntityInstanceFilters', id: 'absent' },
                    type
                )
            ).toEqual(
                type === 'delete' ? ok : { ...ok, response: { uid: 'absent' } }
            )
        }
        await expect(
            answer({ resource: 'trackedEntityInstanceFilters', id: 'absent' })
        ).rejects.toMatchObject({ details: { httpStatusCode: 404 } })
    })

    it('independently verifies raw seed and mutation answers against the production client contracts', async () => {
        const answer = server()
        const mutation = await answer(
            {
                resource: 'trackedEntityInstanceFilters',
                data: {
                    name: 'Compatible',
                    program: 'labProgram1',
                    entityQueryCriteria: { enrollmentStatus: 'ACTIVE' },
                },
            },
            'create'
        )
        expect(MutationResponseSchema.safeParse(mutation).success).toBe(true)
        const entities = await answer({
            resource: 'trackedEntityInstanceFilters',
        })
        const stages = await answer({ resource: 'programStageWorkingLists' })
        expect(
            TrackedEntityInstanceFiltersResponseSchema.safeParse(entities)
                .success
        ).toBe(true)
        expect(
            ProgramStageWorkingListsResponseSchema.safeParse(stages).success
        ).toBe(true)
    })
})

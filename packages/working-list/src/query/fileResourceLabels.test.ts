import type { WorkingListClient } from '../api/client'
import type { FieldCatalog, WorkingListField } from '../domain/model'
import type { TrackedEntityWorkingListPage } from './fetchers'
import {
    collectFileResourceIds,
    createFileResourceNameResolver,
    fetchFileResourceNames,
} from './fileResourceLabels'
import type { NormalizedTrackedEntity } from './normalizeRows'

const fileField: WorkingListField = {
    id: 'FileAttr001',
    displayName: 'Consent form',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'FILE_RESOURCE',
    filterable: false,
}

const imageField: WorkingListField = {
    id: 'ImageAttr01',
    displayName: 'Photo',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'IMAGE',
    filterable: false,
}

const fields: FieldCatalog = new Map([
    [fileField.id, fileField],
    [imageField.id, imageField],
])

const trackedEntityRecord = (
    values: NormalizedTrackedEntity['values']
): NormalizedTrackedEntity => ({
    trackedEntity: {
        trackedEntity: 'Entity00001',
        attributes: [],
        programOwners: [],
    },
    values,
    issues: [],
})

const page = (
    records: NormalizedTrackedEntity[]
): TrackedEntityWorkingListPage => ({
    mode: 'trackedEntity',
    records,
    page: 1,
    pageSize: 15,
    hasNextPage: false,
})

describe('file resource name resolution', () => {
    it('collects only valid FILE_RESOURCE cells, never images or invalid cells', () => {
        const ids = collectFileResourceIds(
            page([
                trackedEntityRecord({
                    [fileField.id]: {
                        valid: true,
                        value: { id: 'FileRes0001', url: '/file' },
                    },
                    [imageField.id]: {
                        valid: true,
                        value: { id: 'ImageRes001', url: '/image' },
                    },
                }),
                trackedEntityRecord({
                    [fileField.id]: {
                        valid: false,
                        raw: 'not a uid',
                        message: 'FILE_RESOURCE requires a DHIS2 UID',
                    },
                }),
            ]),
            fields
        )
        expect(ids).toEqual(['FileRes0001'])
    })

    it('resolves names per resource and tolerates missing file resources', async () => {
        const warn = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined)
        const query = jest.fn(
            (request: { id?: string }): Promise<unknown> =>
                request.id === 'Missing0001'
                    ? Promise.reject(new Error('404 Not Found'))
                    : Promise.resolve({
                          id: request.id,
                          displayName: `${request.id}.pdf`,
                      })
        )
        const client = {
            query,
            mutate: jest.fn(),
        } as unknown as WorkingListClient

        try {
            const names = await fetchFileResourceNames({
                client,
                ids: ['FileRes0001', 'Missing0001', 'FileRes0001'],
            })
            expect(query).toHaveBeenCalledTimes(2)
            expect(query).toHaveBeenCalledWith(
                {
                    resource: 'fileResources',
                    id: 'FileRes0001',
                    params: { fields: 'id,displayName' },
                },
                expect.anything(),
                undefined
            )
            const resolve = createFileResourceNameResolver(names)
            expect(resolve('FileRes0001')).toBe('FileRes0001.pdf')
            expect(resolve('Missing0001')).toBeUndefined()
            expect(warn).toHaveBeenCalledTimes(1)
        } finally {
            warn.mockRestore()
        }
    })
})

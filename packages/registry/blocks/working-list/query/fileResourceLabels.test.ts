import type { FieldCatalog, WorkingListField } from '../domain/model'
import { openWorkingListServer } from '../test/workingListServer'
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

const trackedEntityRecord: (
    values: NormalizedTrackedEntity['values']
) => NormalizedTrackedEntity = (values) => ({
    trackedEntity: {
        trackedEntity: 'Entity00001',
        attributes: [],
        programOwners: [],
    },
    values,
    issues: [],
})

const page: (
    records: NormalizedTrackedEntity[]
) => TrackedEntityWorkingListPage = (records) => ({
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
        const requests: URL[] = []
        const { client } = await openWorkingListServer((url, { method }) => {
            if (method !== 'GET') {
                return undefined
            }
            if (url.pathname.endsWith('/fileResources/Missing0001')) {
                requests.push(url)
                return Response.json({ message: 'Not found' }, { status: 404 })
            }
            if (url.pathname.endsWith('/fileResources/FileRes0001')) {
                requests.push(url)
                return Response.json({
                    id: 'FileRes0001',
                    displayName: 'FileRes0001.pdf',
                })
            }
        })
        const warn = vi.spyOn(console, 'warn')
        try {
            const names = await fetchFileResourceNames({
                client,
                ids: ['FileRes0001', 'Missing0001', 'FileRes0001'],
            })
            expect(requests).toHaveLength(2)
            expect(
                requests.some(
                    ({ pathname, searchParams }) =>
                        pathname.endsWith('/fileResources/FileRes0001') &&
                        searchParams.get('fields') === 'id,displayName'
                )
            ).toBe(true)
            const resolve = createFileResourceNameResolver(names)
            expect(resolve('FileRes0001')).toBe('FileRes0001.pdf')
            expect(resolve('Missing0001')).toBeUndefined()
            expect(warn).toHaveBeenCalledTimes(1)
        } finally {
            warn.mockRestore()
        }
    })
})

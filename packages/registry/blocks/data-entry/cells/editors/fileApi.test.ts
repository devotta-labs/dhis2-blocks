import named from '../../sources/__tests__/fixtures/file-name.json'
import uploaded from '../../sources/__tests__/fixtures/file-upload.json'
import type { DataEngine } from '../../sources/types'
import { eventFileUrl, fileName, uploadFile } from './fileApi'

type Query = Parameters<DataEngine['query']>[0]
type Mutation = Parameters<DataEngine['mutate']>[0]
type MutateOptions = Parameters<DataEngine['mutate']>[1]

/** DHIS2 answering every read and upload with `answer`, keeping what was asked. */
const fakeEngine = (answer: { status?: string; file?: { name: string } }) => {
    const queries: Query[] = []
    const mutations: Array<[Mutation, MutateOptions]> = []
    // SAFETY: the file calls use only `query` and `mutate`.
    const engine = {
        query: async (query: Query) => {
            queries.push(query)
            return answer
        },
        mutate: async (mutation: Mutation, options: MutateOptions) => {
            mutations.push([mutation, options])
            return answer
        },
    } as DataEngine
    return { engine, queries, mutations }
}

test('a file uploads as a data value file and comes back as its id; its name is known without asking', async () => {
    const { engine, mutations, queries } = fakeEngine(uploaded)
    const file = new File(['x'], 'scan.txt')
    const signal = new AbortController().signal
    await expect(uploadFile(engine, file, signal)).resolves.toBe(
        uploaded.response.fileResource.id
    )
    expect(mutations).toEqual([
        [
            {
                resource: 'fileResources',
                type: 'create',
                data: { file, domain: 'DATA_VALUE' },
            },
            { signal },
        ],
    ])
    await expect(
        fileName(engine, uploaded.response.fileResource.id)
    ).resolves.toBe(uploaded.response.fileResource.name)
    expect(queries).toEqual([])
})

test('an upload answer without the file is refused', async () => {
    const { engine } = fakeEngine({ status: 'OK' })
    await expect(
        uploadFile(engine, new File(['x'], 'scan.txt'))
    ).rejects.toThrow()
})

test("a file's name is read from its file resource", async () => {
    const { engine, queries } = fakeEngine({ file: named })
    await expect(fileName(engine, 'nAmE0000001')).resolves.toBe(named.name)
    expect(queries).toEqual([
        {
            file: {
                resource: 'fileResources',
                id: 'nAmE0000001',
                params: { fields: 'name' },
            },
        },
    ])
})

test("an event's file and image are read from the event's data value", () => {
    expect(eventFileUrl('https://dhis2.example.org', 'ev1', 'de1', false)).toBe(
        'https://dhis2.example.org/api/tracker/events/ev1/dataValues/de1/file'
    )
    expect(eventFileUrl('..', 'ev1', 'de1', true)).toBe(
        '../api/tracker/events/ev1/dataValues/de1/image'
    )
})

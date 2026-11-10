import uploaded from '../__tests__/fixtures/file-upload.json'
import type { DataEngine } from '../../provider/context'
import { uploadFile } from './fileApi'

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

test('a file uploads as a data value file and comes back as its id and name', async () => {
    const { engine, mutations } = fakeEngine(uploaded)
    const file = new File(['x'], 'scan.txt')
    const signal = new AbortController().signal
    await expect(uploadFile(engine, file, signal)).resolves.toEqual({
        id: uploaded.response.fileResource.id,
        name: uploaded.response.fileResource.name,
    })
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
})

test('an upload answer without the file is refused', async () => {
    const { engine } = fakeEngine({ status: 'OK' })
    await expect(
        uploadFile(engine, new File(['x'], 'scan.txt'))
    ).rejects.toThrow()
})

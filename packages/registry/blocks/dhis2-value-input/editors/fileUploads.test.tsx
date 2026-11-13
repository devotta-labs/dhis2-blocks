import { CustomDataProvider } from '@dhis2/app-runtime'
import type { ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { useLocalFileUploads } from './fileUploads'

const answer = (id: string) => ({
    status: 'OK',
    response: { fileResource: { id, name: `${id}.txt` } },
})

/** A server that keeps each upload waiting until the test lets it answer, and the signal it was sent with. */
const server = () => {
    const uploads: Array<{ signal?: AbortSignal; release(): void }> = []
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider
            data={{
                fileResources: (_type, _request, execute) =>
                    new Promise((resolve) => {
                        const id = `File${uploads.length + 1}`
                        uploads.push({
                            signal: execute?.signal,
                            release: () => resolve(answer(id)),
                        })
                    }),
            }}
        >
            {children}
        </CustomDataProvider>
    )
    return { uploads, wrapper }
}

const file = new File(['x'], 'scan.txt', { type: 'text/plain' })

const later = (ms: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms)
    })

test('an upload stops when its field leaves the page, and reports nothing', async () => {
    const { uploads, wrapper } = server()
    const { result, unmount } = await renderHook(
        () => useLocalFileUploads(undefined),
        {
            wrapper,
        }
    )
    const done = vi.fn()
    const failed = vi.fn()
    result.current.start(file, false, done, failed)
    await expect.poll(() => uploads).toHaveLength(1)
    expect(result.current.running()).toBe('Uploading scan.txt')

    await unmount()
    expect(uploads[0].signal?.aborted).toBe(true)
    uploads[0].release()
    await later(50)
    expect(done).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
})

test('a newer upload stops the one before', async () => {
    const { uploads, wrapper } = server()
    const { result } = await renderHook(() => useLocalFileUploads(undefined), {
        wrapper,
    })
    const first = vi.fn()
    const second = vi.fn()
    result.current.start(file, false, first, vi.fn())
    await expect.poll(() => uploads).toHaveLength(1)
    result.current.start(file, false, second, vi.fn())
    await expect.poll(() => uploads).toHaveLength(2)
    expect(uploads[0].signal?.aborted).toBe(true)
    expect(uploads[1].signal?.aborted).toBe(false)

    uploads[1].release()
    uploads[0].release()
    await expect.poll(() => second.mock.calls).toEqual([['File2']])
    await later(50)
    expect(first).not.toHaveBeenCalled()
    expect(result.current.running()).toBeUndefined()
})

test('a field makes uploads of its own only when it wants them and is given none', async () => {
    const { wrapper } = server()
    const { result: own } = await renderHook(
        () => useLocalFileUploads(undefined),
        { wrapper }
    )
    const { result: given } = await renderHook(
        () => useLocalFileUploads(own.current),
        { wrapper }
    )
    const { result: unwanted } = await renderHook(
        () => useLocalFileUploads(undefined, false),
        { wrapper }
    )
    expect(given.current).toBe(own.current)
    expect(unwanted.current).toBeUndefined()
})

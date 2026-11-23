import { renderHook } from 'vitest-browser-react'
import { uploadServer } from '../test/uploads.test-utils'
import { useLocalFileUploads } from './fileUploads'

const file = new File(['x'], 'scan.txt', { type: 'text/plain' })

test('an upload stops when its field leaves the page, and reports nothing', async () => {
    const { upload, Server: wrapper } = uploadServer()
    const { result, unmount } = await renderHook(
        () => useLocalFileUploads(undefined),
        {
            wrapper,
        }
    )
    const done = vi.fn()
    const failed = vi.fn()
    result.current.start(file, false, done, failed)
    const firstUpload = await upload(1)
    expect(result.current.running()).toBe('Uploading scan.txt')

    await unmount()
    expect(firstUpload.signal?.aborted).toBe(true)
    await firstUpload.release()
    expect(done).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
})

test('a newer upload stops the one before', async () => {
    const { upload, Server: wrapper } = uploadServer()
    const { result } = await renderHook(() => useLocalFileUploads(undefined), {
        wrapper,
    })
    const first = vi.fn()
    const second = vi.fn()
    result.current.start(file, false, first, vi.fn())
    const firstUpload = await upload(1)
    result.current.start(file, false, second, vi.fn())
    const secondUpload = await upload(2)
    expect(firstUpload.signal?.aborted).toBe(true)
    expect(secondUpload.signal?.aborted).toBe(false)

    await secondUpload.release()
    await firstUpload.release()
    expect(second.mock.calls).toEqual([['File2']])
    expect(first).not.toHaveBeenCalled()
    expect(result.current.running()).toBeUndefined()
})

test('a field makes uploads of its own only when it wants them and is given none', async () => {
    const { Server: wrapper } = uploadServer()
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

import { buffer } from 'node:stream/consumers'
import type { Download, Page } from 'playwright'
import type { BrowserCommandContext } from 'vitest/node'

const armed = new WeakMap<
    Page,
    { download: Promise<Download | null>; cancel: () => void }
>()

export const downloadCommands = {
    armDownload({ page }: BrowserCommandContext) {
        if (armed.has(page)) {
            throw new Error('The previous browser download is still armed')
        }
        const { promise, resolve } = Promise.withResolvers<Download | null>()
        page.once('download', resolve)
        armed.set(page, {
            download: promise,
            cancel() {
                page.off('download', resolve)
                resolve(null)
            },
        })
    },
    async readDownload({ page }: BrowserCommandContext) {
        const listener = armed.get(page)
        if (!listener) {
            throw new Error('Arm the browser download before triggering it')
        }
        const download = await listener.download
        if (!download) {
            throw new Error('The browser download was cancelled')
        }
        armed.delete(page)
        try {
            return {
                filename: download.suggestedFilename(),
                contents: (
                    await buffer(await download.createReadStream())
                ).toString('utf8'),
            }
        } finally {
            await download.delete()
        }
    },
    cancelDownload({ page }: BrowserCommandContext) {
        armed.get(page)?.cancel()
        armed.delete(page)
    },
}

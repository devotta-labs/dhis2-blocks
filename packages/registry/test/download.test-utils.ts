import { onTestFinished } from 'vitest'
import { commands } from 'vitest/browser'

declare module 'vitest/browser' {
    interface BrowserCommands {
        armDownload: () => Promise<void>
        readDownload: () => Promise<{ filename: string; contents: string }>
        cancelDownload: () => Promise<void>
    }
}

/** Arms Playwright's download listener before the test triggers the download. */
export const captureNextDownload = async () => {
    await commands.armDownload()
    onTestFinished(() => commands.cancelDownload())
    return commands.readDownload
}

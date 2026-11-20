import { onTestFinished } from 'vitest'
import { cdp } from 'vitest/browser'

const overrideNetworkStatus = async (offline: boolean) => {
    await cdp().send('Network.overrideNetworkState', {
        offline,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
    })
}

/** Emits Chromium's native online/offline events without disconnecting Vitest's control channel. */
export const setBrowserOffline = async (offline: boolean) => {
    if (offline) {
        onTestFinished(() => overrideNetworkStatus(false))
    }
    await overrideNetworkStatus(offline)
}

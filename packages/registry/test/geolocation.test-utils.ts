import type { BrowserCommandContext } from 'vitest/node'

export const geolocationCommands = {
    async findLocation(
        { context }: BrowserCommandContext,
        coordinates: { latitude: number; longitude: number; accuracy: number }
    ) {
        await context.grantPermissions(['geolocation'])
        await context.setGeolocation(coordinates)
    },
    async allowLocation({ context }: BrowserCommandContext) {
        await context.grantPermissions(['geolocation'])
    },
    async refuseLocation({ context }: BrowserCommandContext) {
        await context.clearPermissions()
    },
    async resetLocation({ context }: BrowserCommandContext) {
        await context.clearPermissions()
        await context.setGeolocation(null)
    },
}

declare module 'vitest/browser' {
    interface BrowserCommands {
        findLocation: (coordinates: {
            latitude: number
            longitude: number
            accuracy: number
        }) => Promise<void>
        allowLocation: () => Promise<void>
        refuseLocation: () => Promise<void>
        resetLocation: () => Promise<void>
    }
}

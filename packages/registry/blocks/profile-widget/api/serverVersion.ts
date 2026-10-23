export interface ProfileServerFeatures {
    minorVersion: number
    changelogFilterAndOrder: boolean
    trackedEntityTypeChangeLog: boolean
    programTerminology: boolean
}

interface RuntimeVersionConfig {
    apiVersion?: number
    serverVersion?: { major: number; minor: number }
}

const FALLBACK_MINOR_VERSION = 41

export const resolveServerFeatures = (
    config: RuntimeVersionConfig
): ProfileServerFeatures => {
    const fromServer =
        config.serverVersion?.major === 2 &&
        Number.isInteger(config.serverVersion.minor)
            ? config.serverVersion.minor
            : undefined
    const fromApi =
        config.apiVersion !== undefined &&
        Number.isInteger(config.apiVersion) &&
        config.apiVersion > 0
            ? config.apiVersion
            : undefined
    const minorVersion = fromServer ?? fromApi ?? FALLBACK_MINOR_VERSION

    return {
        minorVersion,
        changelogFilterAndOrder: minorVersion >= 42,
        trackedEntityTypeChangeLog: minorVersion >= 43,
        programTerminology: minorVersion >= 43,
    }
}

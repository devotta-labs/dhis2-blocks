/** Server-version gates the block depends on. */
export interface ProfileServerFeatures {
    /** DHIS2 minor version, e.g. 43 for 2.43.1. */
    minorVersion: number
    /** Changelog `filter=attribute:eq:` and `order=username|attribute` (2.42+). */
    changelogFilterAndOrder: boolean
    /** `TrackedEntityType.enableChangeLog` exists (2.43+). */
    trackedEntityTypeChangeLog: boolean
    /** Program custom terminology labels (2.43+). */
    programTerminology: boolean
}

interface RuntimeVersionConfig {
    apiVersion?: number
    serverVersion?: { major: number; minor: number }
}

/** The oldest server the block supports; used when nothing is known. */
const FALLBACK_MINOR_VERSION = 41

/**
 * DHIS2 reports 2.43 as `{ major: 2, minor: 43 }`. When the server version is
 * missing (tests, early app-runtime), the API version (43) is the minor.
 */
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

import type { TrackerProgram } from './schemas'

export interface MetadataFeaturePresence {
    preferredSearchOperator: boolean
    blockedSearchOperators: boolean
    minimumSearchLength: boolean
}

export interface WorkingListCapabilities {
    apiVersion: number
    supported: boolean
    enrollmentStatusParameter: 'enrollmentStatus' | 'programStatus'
    emptyValueFilters: boolean
    metadataSearchOperators: boolean
    minimumSearchLength: boolean
    multipleOptionValues: boolean
    supportsValueTypeFilter(valueType: string): boolean
}

export const detectMetadataFeatures = (
    program: TrackerProgram
): MetadataFeaturePresence => {
    const bindings = program.programTrackedEntityAttributes

    return {
        preferredSearchOperator: bindings.some(
            (binding) =>
                binding.preferredSearchOperator != null ||
                binding.trackedEntityAttribute.preferredSearchOperator != null
        ),
        blockedSearchOperators: bindings.some(
            (binding) =>
                binding.blockedSearchOperators !== undefined ||
                binding.trackedEntityAttribute.blockedSearchOperators !==
                    undefined
        ),
        minimumSearchLength: bindings.some(
            (binding) =>
                binding.minCharactersToSearch !== undefined ||
                binding.trackedEntityAttribute.minCharactersToSearch !==
                    undefined
        ),
    }
}

export const resolveWorkingListCapabilities = ({
    apiVersion,
    metadataFeatures,
}: {
    apiVersion: number
    metadataFeatures?: Partial<MetadataFeaturePresence>
}): WorkingListCapabilities => {
    if (!Number.isInteger(apiVersion) || apiVersion <= 0) {
        throw new Error(`Invalid DHIS2 apiVersion: ${apiVersion}`)
    }

    const metadataSearchOperators = Boolean(
        metadataFeatures?.preferredSearchOperator ||
        metadataFeatures?.blockedSearchOperators
    )

    const minimumSearchLength = Boolean(metadataFeatures?.minimumSearchLength)
    const emptyValueFilters = apiVersion >= 42

    return {
        apiVersion,
        supported: apiVersion >= 41,
        enrollmentStatusParameter:
            apiVersion >= 42 ? 'enrollmentStatus' : 'programStatus',
        emptyValueFilters,
        metadataSearchOperators,
        minimumSearchLength,
        // Tracker has supported an `in` expression with multiple option codes
        // throughout the supported API range (including MULTI_TEXT on v41).
        multipleOptionValues: apiVersion >= 41,
        supportsValueTypeFilter(valueType: string) {
            if (
                ['GEOJSON', 'REFERENCE', 'TRACKER_ASSOCIATE'].includes(
                    valueType
                )
            ) {
                return false
            }

            if (
                !emptyValueFilters &&
                ['COORDINATE', 'FILE_RESOURCE', 'IMAGE', 'URL'].includes(
                    valueType
                )
            ) {
                return false
            }

            return true
        },
    }
}

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { toProfileWidgetLoadError } from '../api/client'
import { TrackedEntityNotAccessibleError } from '../errors'
import { profileWidgetQueryKeys } from '../api/queryKeys'
import {
    useProfileServerFeatures,
    useProfileWidgetClient,
} from '../api/runtime'
import type {
    ProfileWidgetLoadError,
    TrackedEntityProfileData,
    UseTrackedEntityProfileOptions,
    UseTrackedEntityProfileResult,
} from '../types'
import { useFormattedFields } from './formatting/useFormattedFields'
import {
    buildAttributeDefinitions,
    buildDisplayName,
    buildProfileTitle,
    resolveProfileLabels,
    toAttributeFields,
    toFormattableFields,
} from './normalize'
import { resolveProfilePermissions } from './permissions'
import {
    authoritiesQueryOptions,
    programMetadataQueryOptions,
    trackedEntityRecordQueryOptions,
    trackedEntityTypeMetadataQueryOptions,
} from './queries'
import { selectDisplayInListAttributes } from './selectDisplayInListAttributes'

export function useTrackedEntityProfile(
    options: UseTrackedEntityProfileOptions
): UseTrackedEntityProfileResult {
    const { trackedEntityId, selectFields } = options
    const programId = options.programId || null
    const client = useProfileWidgetClient()
    const queryClient = useQueryClient()
    const features = useProfileServerFeatures()

    const recordQuery = useQuery(
        trackedEntityRecordQueryOptions(client, { trackedEntityId, programId })
    )
    const programQuery = useQuery({
        ...programMetadataQueryOptions(client, {
            programId: programId ?? '',
            features,
        }),
        enabled: programId !== null,
    })
    const recordTrackedEntityTypeId = recordQuery.data?.trackedEntityType
    const trackedEntityTypeQuery = useQuery({
        ...trackedEntityTypeMetadataQueryOptions(client, {
            trackedEntityTypeId: recordTrackedEntityTypeId ?? '',
            features,
        }),
        enabled: programId === null && recordTrackedEntityTypeId !== undefined,
    })
    const authoritiesQuery = useQuery(authoritiesQueryOptions(client))

    const record = recordQuery.data
    const program = programId === null ? null : programQuery.data
    const trackedEntityType =
        programId === null
            ? trackedEntityTypeQuery.data
            : programQuery.data?.trackedEntityType
    const programTypeMismatch =
        programId !== null &&
        record !== undefined &&
        trackedEntityType !== undefined &&
        record.trackedEntityType !== trackedEntityType.id

    const definitions = useMemo(
        () =>
            trackedEntityType && program !== undefined && !programTypeMismatch
                ? buildAttributeDefinitions({
                      trackedEntityTypeAttributes:
                          trackedEntityType.trackedEntityTypeAttributes,
                      programAttributes:
                          program?.programTrackedEntityAttributes ?? null,
                  })
                : undefined,
        [trackedEntityType, program, programTypeMismatch]
    )
    const formattableFields = useMemo(
        () =>
            definitions && record
                ? toFormattableFields(definitions, record, programId)
                : undefined,
        [definitions, record, programId]
    )
    const formatted = useFormattedFields(formattableFields)
    const attributes = useMemo(
        () =>
            definitions && formatted.data
                ? toAttributeFields(definitions, formatted.data)
                : undefined,
        [definitions, formatted.data]
    )

    const select = selectFields ?? selectDisplayInListAttributes
    const authorities = authoritiesQuery.data
    const data = useMemo((): TrackedEntityProfileData | undefined => {
        if (
            programTypeMismatch ||
            !record ||
            !trackedEntityType ||
            program === undefined ||
            !attributes ||
            !authorities
        ) {
            return undefined
        }
        const trackedEntityTypeName = trackedEntityType.displayName ?? ''
        return {
            title: buildProfileTitle(trackedEntityType.displayName),
            displayName: buildDisplayName(
                trackedEntityType.trackedEntityTypeAttributes,
                attributes
            ),
            attributes,
            fields: select(attributes),
            labels: resolveProfileLabels(program),
            trackedEntity: {
                id: record.trackedEntity,
                programId,
                trackedEntityTypeId: record.trackedEntityType,
                trackedEntityTypeName,
                orgUnitId: record.orgUnit ?? '',
                inactive: record.inactive,
            },
            permissions: resolveProfilePermissions({
                trackedEntityType,
                trackedEntityTypeName,
                program,
                record,
                authorities,
            }),
        }
    }, [
        programTypeMismatch,
        record,
        trackedEntityType,
        program,
        attributes,
        authorities,
        select,
        programId,
    ])

    const recordError = recordQuery.error
    const programError = programId === null ? null : programQuery.error
    const trackedEntityTypeError =
        programId === null ? trackedEntityTypeQuery.error : null
    const authoritiesError = authoritiesQuery.error
    const formatterError = formatted.error
    const error = useMemo((): ProfileWidgetLoadError | null => {
        if (recordError) {
            return toProfileWidgetLoadError(
                recordError,
                'Load tracked entity',
                {
                    trackedEntityId,
                    programId,
                }
            )
        }
        if (programError) {
            return toProfileWidgetLoadError(programError, 'Load program')
        }
        if (programTypeMismatch) {
            return new TrackedEntityNotAccessibleError({
                trackedEntityId,
                programId,
                httpStatus: 404,
                message: `Load tracked entity: tracked entity ${trackedEntityId} is not of the tracked entity type of program ${programId ?? ''} (404)`,
            })
        }
        if (trackedEntityTypeError) {
            return toProfileWidgetLoadError(
                trackedEntityTypeError,
                'Load tracked entity type'
            )
        }
        if (authoritiesError) {
            return toProfileWidgetLoadError(
                authoritiesError,
                'Load user authorities'
            )
        }
        return formatterError
    }, [
        recordError,
        programError,
        programTypeMismatch,
        trackedEntityTypeError,
        authoritiesError,
        formatterError,
        trackedEntityId,
        programId,
    ])

    const refetchRecord = recordQuery.refetch
    const refetchProgram = programQuery.refetch
    const refetchTrackedEntityType = trackedEntityTypeQuery.refetch
    const refetchAuthorities = authoritiesQuery.refetch
    const refetch = useCallback(() => {
        void refetchRecord()
        if (programError) void refetchProgram()
        if (trackedEntityTypeError) void refetchTrackedEntityType()
        if (authoritiesError) void refetchAuthorities()
        if (formatterError) {
            void queryClient.refetchQueries({
                queryKey: profileWidgetQueryKeys.systemInfo(),
                type: 'active',
            })
            void queryClient.refetchQueries({
                queryKey: profileWidgetQueryKeys.lookups(),
                type: 'active',
            })
        }
    }, [
        refetchRecord,
        refetchProgram,
        refetchTrackedEntityType,
        refetchAuthorities,
        programError,
        trackedEntityTypeError,
        authoritiesError,
        formatterError,
        queryClient,
    ])

    const isFetching =
        recordQuery.isFetching ||
        (programId !== null && programQuery.isFetching) ||
        (programId === null && trackedEntityTypeQuery.isFetching) ||
        authoritiesQuery.isFetching

    return {
        data,
        error,
        isPending: error === null && data === undefined,
        isFetching,
        refetch,
    }
}

import { useConfig, useOnlineStatus } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import {
    detectMetadataFeatures,
    resolveWorkingListCapabilities,
} from '../api/capabilities'
import type { WorkingListClient } from '../api/client'
import {
    buildProgramFieldCatalog,
    trackerProgramQueryOptions,
} from '../api/metadata'
import {
    createDefaultWorkingList,
    createGeneratedDefaultLists,
    defaultWorkingListId,
} from '../api/savedLists'
import { workingListSystemInfoQueryOptions } from '../api/systemInfo'
import { createWorkingListValueTransformers } from '../registry/transformers'
import { defaultWorkingListTranslate } from '../ui/WorkingListText'
import { WorkingListInitializationError } from './errors'
import type { WorkingListProviderStoreState } from './store'

const RuntimeConfigSchema = z
    .object({ apiVersion: z.coerce.number().int().positive() })
    .passthrough()

interface UseWorkingListLifecycleOptions {
    client: WorkingListClient
    programId: string
    updateStore: (
        update: (
            current: WorkingListProviderStoreState
        ) => Partial<WorkingListProviderStoreState>
    ) => void
}

export const useWorkingListLifecycle = ({
    client,
    programId,
    updateStore,
}: UseWorkingListLifecycleOptions) => {
    const config = useConfig()

    const runtimeConfig = useMemo(
        () => RuntimeConfigSchema.safeParse(config),
        [config]
    )

    const apiVersion = runtimeConfig.success
        ? runtimeConfig.data.apiVersion
        : 41

    const { online } = useOnlineStatus()
    const translate = defaultWorkingListTranslate
    const locale = i18n.language ?? globalThis.navigator?.language ?? 'en'
    const systemInfoQuery = useQuery(workingListSystemInfoQueryOptions(client))

    const programQuery = useQuery(
        trackerProgramQueryOptions(client, programId, apiVersion)
    )

    const program = programQuery.data
    const systemInfo = systemInfoQuery.data

    const capabilities = useMemo(
        () =>
            resolveWorkingListCapabilities({
                apiVersion,
                metadataFeatures: program
                    ? detectMetadataFeatures(program)
                    : undefined,
            }),
        [apiVersion, program]
    )

    const metadataResolution = useMemo(() => {
        if (
            !program ||
            !capabilities.supported ||
            program.programType !== 'WITH_REGISTRATION'
        ) {
            return {}
        }

        try {
            return {
                metadata: buildProgramFieldCatalog({
                    program,
                    capabilities,
                    hasSelectedOrgUnit: true,
                }),
            }
        } catch (cause) {
            return {
                error: new WorkingListInitializationError({
                    message: `Program ${programId} metadata could not be interpreted`,
                    cause,
                }),
            }
        }
    }, [capabilities, program, programId])

    const metadata = metadataResolution.metadata

    const lifecycleError = useMemo(() => {
        if (!runtimeConfig.success) {
            return new WorkingListInitializationError({
                message:
                    'DHIS2 runtime configuration did not contain a valid API version',
                cause: runtimeConfig.error,
            })
        }

        if (!capabilities.supported) {
            return new WorkingListInitializationError({
                message: `DHIS2 API version ${apiVersion} is unsupported; Working List requires version 41 or newer`,
            })
        }

        if (systemInfoQuery.error) {
            return new WorkingListInitializationError({
                message: 'DHIS2 system information could not be loaded',
                cause: systemInfoQuery.error,
            })
        }

        if (programQuery.error) {
            return new WorkingListInitializationError({
                message: `Program ${programId} metadata could not be loaded`,
                cause: programQuery.error,
            })
        }

        if (program && program.programType !== 'WITH_REGISTRATION') {
            return new WorkingListInitializationError({
                message: `Program ${programId} is not a tracker program with registration`,
            })
        }

        return metadataResolution.error
    }, [
        apiVersion,
        capabilities.supported,
        metadataResolution.error,
        program,
        programId,
        programQuery.error,
        runtimeConfig,
        systemInfoQuery.error,
    ])

    const lifecycleReady = Boolean(
        program && systemInfo && metadata && !lifecycleError
    )

    const valueTransformers = useMemo(
        () =>
            systemInfo
                ? createWorkingListValueTransformers({
                      systemInfo,
                      locale,
                      trueLabel: translate('Yes'),
                      falseLabel: translate('No'),
                  })
                : undefined,
        [locale, systemInfo, translate]
    )

    const parsingContext = valueTransformers?.parsingContext
    const serializationContext = valueTransformers?.serializationContext

    const calendarContext = useMemo(
        () =>
            systemInfo
                ? {
                      calendar: systemInfo.calendar,
                      dateFormat: systemInfo.dateFormat,
                      locale,
                      timeZone: systemInfo.serverTimeZoneId,
                  }
                : undefined,
        [locale, systemInfo]
    )

    const defaultList = useMemo(
        () =>
            metadata
                ? createDefaultWorkingList({
                      programId,
                      columns: metadata.defaultTrackedEntityColumns,
                  })
                : undefined,
        [metadata, programId]
    )

    const generatedLists = useMemo(
        () =>
            metadata
                ? createGeneratedDefaultLists({
                      programId,
                      columns: metadata.defaultTrackedEntityColumns,
                      fields: metadata.fields,
                  })
                : [],
        [metadata, programId]
    )

    const defaultListId = defaultWorkingListId(programId)

    useEffect(() => {
        updateStore((current) => ({
            meta: {
                ...current.meta,
                lifecycle: lifecycleError
                    ? { status: 'error', error: lifecycleError }
                    : lifecycleReady
                      ? { status: 'ready' }
                      : { status: 'pending' },
                online,
                program,
                systemInfo,
                capabilities,
                fieldCatalog: metadata,
                fields: metadata ? [...metadata.fields.values()] : [],
            },
        }))
    }, [
        capabilities,
        lifecycleError,
        lifecycleReady,
        metadata,
        online,
        program,
        systemInfo,
        updateStore,
    ])

    return {
        online,
        translate,
        locale,
        program,
        systemInfo,
        capabilities,
        metadata,
        parsingContext,
        serializationContext,
        calendarContext,
        defaultList,
        generatedLists,
        defaultListId,
        lifecycleReady,
    }
}

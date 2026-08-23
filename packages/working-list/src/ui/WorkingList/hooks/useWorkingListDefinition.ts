import { useMemo } from 'react'
import {
    detectMetadataFeatures,
    resolveWorkingListCapabilities,
} from '../../../api/capabilities'
import { buildProgramFieldCatalog } from '../../../api/metadata'
import {
    createDefaultWorkingList,
    createGeneratedDefaultLists,
} from '../../../api/savedLists'
import type { TrackerProgram } from '../../../api/schemas'
import type { WorkingListSystemInfo } from '../../../api/systemInfo'
import { createWorkingListValueTransformers } from '../../../registry/transformers'
import { useWorkingListText } from '../../WorkingListText'

interface WorkingListDefinitionOptions {
    apiVersion: number
    program: TrackerProgram
    systemInfo: WorkingListSystemInfo
    configuredLocale?: string
}

export const useWorkingListDefinition = ({
    apiVersion,
    program,
    systemInfo,
    configuredLocale,
}: WorkingListDefinitionOptions) => {
    const translate = useWorkingListText()
    const locale = configuredLocale ?? globalThis.navigator?.language ?? 'en'
    const valueTransformers = useMemo(
        () =>
            createWorkingListValueTransformers({
                systemInfo,
                locale,
                trueLabel: translate('Yes'),
                falseLabel: translate('No'),
            }),
        [locale, systemInfo, translate]
    )
    const filterCalendarContext = useMemo(
        () => ({
            calendar: systemInfo.calendar,
            dateFormat: systemInfo.dateFormat,
            locale,
            timeZone: systemInfo.serverTimeZoneId,
        }),
        [locale, systemInfo]
    )
    const capabilities = useMemo(
        () =>
            resolveWorkingListCapabilities({
                apiVersion,
                metadataFeatures: detectMetadataFeatures(program),
            }),
        [apiVersion, program]
    )
    const metadata = useMemo(
        () =>
            buildProgramFieldCatalog({
                program,
                capabilities,
                hasSelectedOrgUnit: true,
            }),
        [capabilities, program]
    )
    const fields = useMemo(
        () => [...metadata.fields.values()],
        [metadata.fields]
    )
    const generatedLists = useMemo(
        () =>
            createGeneratedDefaultLists({
                programId: program.id,
                columns: metadata.defaultTrackedEntityColumns,
                fields: metadata.fields,
            }),
        [metadata, program.id]
    )
    const defaultList = useMemo(
        () =>
            createDefaultWorkingList({
                programId: program.id,
                columns: metadata.defaultTrackedEntityColumns,
            }),
        [metadata.defaultTrackedEntityColumns, program.id]
    )
    if (!defaultList.configuration.columns.length) {
        throw new Error(
            `Program ${program.id} has no usable default working list`
        )
    }

    return {
        locale,
        valueTransformers,
        filterCalendarContext,
        capabilities,
        metadata,
        fields,
        generatedLists,
        defaultList,
    }
}

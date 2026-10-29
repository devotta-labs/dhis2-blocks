import { useConfig } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toProfileWidgetRequestError } from '../../api/client'
import { useProfileWidgetClient } from '../../api/runtime'
import { systemInfoQueryOptions } from '../queries'
import type { FormattableValue, ValueFormatterState } from './contracts'
import { createValueFormatter } from './formatValue'
import {
    collectLookupIds,
    fileResourceNamesQueryOptions,
    organisationUnitsQueryOptions,
    type OrganisationUnitLookup,
} from './lookups'

const NO_IDS: readonly string[] = []
const NO_FILE_RESOURCE_NAMES: ReadonlyMap<string, string> = new Map()
const NO_ORGANISATION_UNITS: ReadonlyMap<string, OrganisationUnitLookup> =
    new Map()

export function useValueFormatter(
    values: readonly FormattableValue[] | undefined
): ValueFormatterState {
    const client = useProfileWidgetClient()
    const { baseUrl, apiVersion } = useConfig()
    const lookupIds = useMemo(
        () => (values ? collectLookupIds(values) : undefined),
        [values]
    )
    const fileResourceIds = lookupIds?.fileResourceIds ?? NO_IDS
    const organisationUnitIds = lookupIds?.organisationUnitIds ?? NO_IDS

    const systemInfo = useQuery(systemInfoQueryOptions(client))
    const fileResourceNames = useQuery({
        ...fileResourceNamesQueryOptions(client, fileResourceIds),
        enabled: fileResourceIds.length > 0,
    })
    const organisationUnits = useQuery({
        ...organisationUnitsQueryOptions(client, organisationUnitIds),
        enabled: organisationUnitIds.length > 0,
    })

    const systemInfoData = systemInfo.data
    const fileResourceNamesData =
        fileResourceIds.length > 0
            ? fileResourceNames.data
            : NO_FILE_RESOURCE_NAMES
    const organisationUnitsData =
        organisationUnitIds.length > 0
            ? organisationUnits.data
            : NO_ORGANISATION_UNITS
    const formatter = useMemo(
        () =>
            lookupIds !== undefined &&
            systemInfoData !== undefined &&
            fileResourceNamesData !== undefined &&
            organisationUnitsData !== undefined
                ? createValueFormatter({
                      systemInfo: systemInfoData,
                      api: { baseUrl, apiVersion },
                      fileResourceNames: fileResourceNamesData,
                      organisationUnits: organisationUnitsData,
                  })
                : undefined,
        [
            lookupIds,
            systemInfoData,
            fileResourceNamesData,
            organisationUnitsData,
            baseUrl,
            apiVersion,
        ]
    )

    const error = useMemo(() => {
        if (systemInfo.error) {
            return toProfileWidgetRequestError(
                systemInfo.error,
                'Load system settings'
            )
        }
        if (fileResourceIds.length > 0 && fileResourceNames.error) {
            return toProfileWidgetRequestError(
                fileResourceNames.error,
                'Load file names'
            )
        }
        if (organisationUnitIds.length > 0 && organisationUnits.error) {
            return toProfileWidgetRequestError(
                organisationUnits.error,
                'Load organisation units'
            )
        }
        return null
    }, [
        systemInfo.error,
        fileResourceNames.error,
        organisationUnits.error,
        fileResourceIds.length,
        organisationUnitIds.length,
    ])

    return {
        formatter: error ? undefined : formatter,
        error,
        isPending: error === null && formatter === undefined,
    }
}

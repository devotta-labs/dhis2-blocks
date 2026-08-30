import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { trackerProgramsQueryOptions } from '@dhis2-blocks/working-list/development'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
    AppRuntimeConfigSchema,
    ProgramOrganisationUnitsSchema,
    retryOperationalError,
} from '../AppShell/contextSchemas'
import { createAppWorkingListClient } from '../AppShell/createAppWorkingListClient'
import { hasCaptureProgramDataReadAccess } from '../AppShell/programOptions'

export interface ShowcaseOption {
    id: string
    displayName: string
}

export interface ShowcaseContext {
    programs: ShowcaseOption[]
    organisationUnits: ShowcaseOption[]
    programId?: string
    orgUnitId?: string
    loading: boolean
    errorMessage?: string
    selectProgram(programId: string): void
    selectOrgUnit(orgUnitId: string): void
}

/**
 * Minimal program/org-unit context for the styling showcase routes. The main
 * app shell owns the guarded selectors; here the first accessible program and
 * organisation unit are chosen automatically so each variant renders data
 * immediately.
 */
export const useShowcaseContext = (): ShowcaseContext => {
    const engine = useDataEngine()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => AppRuntimeConfigSchema.parse(config),
        [config]
    )
    const client = useMemo(() => createAppWorkingListClient(engine), [engine])
    const [selectedProgramId, setSelectedProgramId] = useState<string>()
    const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<string>()

    const programsQuery = useQuery(
        trackerProgramsQueryOptions(client, runtimeConfig.apiVersion)
    )
    const programs = useMemo(
        () =>
            (programsQuery.data?.programs ?? [])
                .filter(
                    (program) =>
                        program.programType === 'WITH_REGISTRATION' &&
                        hasCaptureProgramDataReadAccess(program)
                )
                .map((program) => ({
                    id: program.id,
                    displayName: program.displayName,
                })),
        [programsQuery.data]
    )
    const programId =
        programs.find((program) => program.id === selectedProgramId)?.id ??
        programs[0]?.id

    const orgUnitsQuery = useQuery({
        queryKey: ['working-list', 'showcase', 'program-org-units', programId],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'programs',
                    id: programId,
                    params: {
                        fields: 'organisationUnits[id,displayName,path]',
                    },
                },
                ProgramOrganisationUnitsSchema,
                signal
            ),
        enabled: Boolean(programId),
        staleTime: 60 * 60 * 1000,
        retry: retryOperationalError,
    })
    const organisationUnits = useMemo(
        () =>
            (orgUnitsQuery.data?.organisationUnits ?? []).map((unit) => ({
                id: unit.id,
                displayName: unit.displayName,
            })),
        [orgUnitsQuery.data]
    )
    const orgUnitId =
        organisationUnits.find((unit) => unit.id === selectedOrgUnitId)?.id ??
        organisationUnits[0]?.id
    const failure = programsQuery.error ?? orgUnitsQuery.error

    return {
        programs,
        organisationUnits,
        programId,
        orgUnitId,
        loading:
            programsQuery.isPending ||
            (Boolean(programId) && orgUnitsQuery.isPending),
        errorMessage: failure
            ? failure instanceof Error
                ? failure.message
                : String(failure)
            : undefined,
        selectProgram: (nextProgramId) => {
            setSelectedProgramId(nextProgramId)
            setSelectedOrgUnitId(undefined)
        },
        selectOrgUnit: setSelectedOrgUnitId,
    }
}

import type { WorkingListClient } from '@/components/working-list/api/client'
import { trackerProgramsQueryOptions } from '@/components/working-list/api/metadata'
import { useQuery } from '@tanstack/react-query'
import type { OrganisationUnitReference } from '../organisationUnitScope'
import {
    ProgramOrganisationUnitsSchema,
    retryOperationalError,
} from './contextSchemas'
import {
    hasCaptureProgramDataReadAccess,
    projectProgramOptions,
} from './programOptions'

interface ProgramContextOptions {
    client: WorkingListClient
    programId?: string
    selectedOrganisationUnit?: OrganisationUnitReference
    captureRoots: OrganisationUnitReference[]
    baseUrl: string
    apiVersion: number
}

export const useProgramContext = ({
    client,
    programId,
    selectedOrganisationUnit,
    captureRoots,
    baseUrl,
    apiVersion,
}: ProgramContextOptions) => {
    const programsQuery = useQuery(
        trackerProgramsQueryOptions(client, apiVersion)
    )
    const programs = (programsQuery.data?.programs ?? []).filter(
        (program) =>
            program.programType === 'WITH_REGISTRATION' &&
            hasCaptureProgramDataReadAccess(program)
    )
    const selectedProgram = programs.find((program) => program.id === programId)
    const needsAssignments = Boolean(
        selectedProgram && selectedProgram.organisationUnits === undefined
    )
    const assignmentsQuery = useQuery({
        queryKey: ['working-list', 'shell', 'program-org-units', programId],
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
        enabled: needsAssignments,
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: retryOperationalError,
    })
    const projection = projectProgramOptions({
        programs,
        selectedProgramId: programId,
        selectedOrganisationUnit,
        captureRoots,
        selectedProgramOrganisationUnits:
            assignmentsQuery.data?.organisationUnits,
        baseUrl,
        apiVersion,
    })
    return {
        ...projection,
        selectedProgram,
        programsLoading: programsQuery.isPending,
        loading:
            programsQuery.isPending ||
            (needsAssignments && assignmentsQuery.isPending),
        error:
            programsQuery.error ??
            (needsAssignments ? assignmentsQuery.error : undefined),
        retry: () => {
            void programsQuery.refetch()
            if (needsAssignments) void assignmentsQuery.refetch()
        },
    }
}

import type { Option } from '@/components/context-selector'
import {
    isOrganisationUnitAssigned,
    isOrganisationUnitInScope,
    type OrganisationUnitReference,
} from '../organisationUnitScope'

interface ProgramSummary {
    id: string
    displayName: string
    style?: { color?: string; icon?: string }
    organisationUnits?: Array<{ id: string; path: string }>
    access?: { data?: { read?: boolean } }
}

export const hasCaptureProgramDataReadAccess = (program: ProgramSummary) =>
    program.access?.data?.read === true

export const projectProgramOptions = ({
    programs,
    selectedOrganisationUnit,
    selectedProgramId,
    selectedProgramOrganisationUnits,
    captureRoots,
    baseUrl,
    apiVersion,
}: {
    programs: ProgramSummary[]
    selectedOrganisationUnit?: { id?: string; path: string }
    selectedProgramId?: string
    selectedProgramOrganisationUnits?: Array<{ id: string; path: string }>
    captureRoots: OrganisationUnitReference[]
    baseUrl: string
    apiVersion: number
}) => {
    const assignmentsFor = (program: ProgramSummary) =>
        program.id === selectedProgramId
            ? (program.organisationUnits ??
              selectedProgramOrganisationUnits ??
              [])
            : (program.organisationUnits ?? [])
    const compatiblePrograms = selectedOrganisationUnit
        ? programs.filter((program) =>
              isOrganisationUnitAssigned(
                  selectedOrganisationUnit,
                  assignmentsFor(program)
              )
          )
        : programs
    const selectedProgram = programs.find(
        (program) => program.id === selectedProgramId
    )
    const preservedProgram = selectedProgramId
        ? programs.find(
              (program) =>
                  program.id === selectedProgramId &&
                  !compatiblePrograms.includes(program)
          )
        : undefined
    const availablePrograms = preservedProgram
        ? [preservedProgram, ...compatiblePrograms]
        : compatiblePrograms

    const options = availablePrograms.map((program) => {
        const option: Option = {
            value: program.id,
            label: program.displayName,
            icon: program.style?.icon
                ? {
                      source: `${baseUrl.replace(/\/$/, '')}/api/${apiVersion}/icons/${encodeURIComponent(program.style.icon)}/icon`,
                      color: program.style.color,
                      alternativeText: program.style.icon,
                  }
                : undefined,
        }
        if (program === preservedProgram) {
            option.excludeFromMenu = true
        }
        return option
    })
    let availability: 'all' | 'filtered' | 'empty' = 'all'
    if (compatiblePrograms.length === 0) availability = 'empty'
    else if (compatiblePrograms.length < programs.length)
        availability = 'filtered'
    return {
        options,
        availability,
        selectedOrgUnitIsAllowed: Boolean(
            selectedProgram &&
            isOrganisationUnitInScope(
                selectedOrganisationUnit,
                captureRoots,
                assignmentsFor(selectedProgram)
            )
        ),
    }
}

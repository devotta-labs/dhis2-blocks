import type { Option } from '@dhis2-blocks/context-selector'

interface ProgramSummary {
    id: string
    displayName: string
    style?: { color?: string; icon?: string }
    organisationUnits?: Array<{ id: string; path: string }>
    access?: { data?: { read?: boolean } }
}

export const hasCaptureProgramDataReadAccess = (program: ProgramSummary) =>
    program.access?.data?.read === true

export const buildProgramOptions = ({
    programs,
    selectedOrganisationUnitId,
    selectedOrganisationUnitPath,
    preservedProgramId,
    baseUrl,
    apiVersion,
}: {
    programs: ProgramSummary[]
    selectedOrganisationUnitId?: string
    selectedOrganisationUnitPath?: string
    preservedProgramId?: string
    baseUrl: string
    apiVersion: number
}): Option[] => {
    const compatiblePrograms = selectedOrganisationUnitPath
        ? programs.filter((program) =>
              (program.organisationUnits ?? []).some((unit) =>
                  selectedOrganisationUnitId
                      ? unit.id === selectedOrganisationUnitId
                      : unit.path === selectedOrganisationUnitPath
              )
          )
        : programs

    const preservedProgram = preservedProgramId
        ? programs.find(
              (program) =>
                  program.id === preservedProgramId &&
                  !compatiblePrograms.includes(program)
          )
        : undefined

    const availablePrograms = preservedProgram
        ? [preservedProgram, ...compatiblePrograms]
        : compatiblePrograms

    return availablePrograms.map((program) => {
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
}

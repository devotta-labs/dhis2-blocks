import type { ContextOption } from '@dhis2-blocks/context-selector'
import { areOrganisationUnitPathsRelated } from '../organisationUnitScope'

interface ProgramSummary {
    id: string
    displayName: string
    style?: { color?: string; icon?: string }
    organisationUnits?: Array<{ path: string }>
    access?: { data?: { read?: boolean } }
}

export const hasCaptureProgramDataReadAccess = (program: ProgramSummary) =>
    program.access?.data?.read === true

export const buildProgramOptions = ({
    programs,
    selectedOrganisationUnitPath,
    baseUrl,
    apiVersion,
}: {
    programs: ProgramSummary[]
    selectedOrganisationUnitPath?: string
    baseUrl: string
    apiVersion: number
}): ContextOption[] => {
    const availablePrograms = selectedOrganisationUnitPath
        ? programs.filter((program) =>
              (program.organisationUnits ?? []).some((unit) =>
                  areOrganisationUnitPathsRelated(
                      unit.path,
                      selectedOrganisationUnitPath
                  )
              )
          )
        : programs

    return availablePrograms.map((program) => ({
        value: program.id,
        label: program.displayName,
        icon: program.style?.icon
            ? {
                  source: `${baseUrl.replace(/\/$/, '')}/api/${apiVersion}/icons/${encodeURIComponent(program.style.icon)}/icon`,
                  color: program.style.color,
                  alternativeText: program.style.icon,
              }
            : undefined,
    }))
}

import type { OrganisationUnitReference } from '../organisationUnitScope'

// Retained only for the legacy branch tests scheduled for T06 cleanup.
export const areOrganisationUnitPathsRelated = (left: string, right: string) =>
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)

export const getCaptureOrganisationUnitPickerScope = (
    roots: OrganisationUnitReference[]
) => ({ allowedPaths: [], pickerRoots: roots })

export const intersectOrganisationUnitScopes = (
    searchRoots: OrganisationUnitReference[],
    programOrganisationUnits: OrganisationUnitReference[]
) => ({
    allowedPaths: programOrganisationUnits
        .filter((programUnit) =>
            searchRoots.some((searchRoot) =>
                areOrganisationUnitPathsRelated(
                    programUnit.path,
                    searchRoot.path
                )
            )
        )
        .map((unit) => unit.path),
    pickerRoots: searchRoots.filter((searchRoot) =>
        programOrganisationUnits.some((programUnit) =>
            areOrganisationUnitPathsRelated(programUnit.path, searchRoot.path)
        )
    ),
})

export const buildOrganisationUnitTreeFilter = (
    allowedPaths: string[],
    visibleRoots: OrganisationUnitReference[]
) =>
    allowedPaths.length === 0
        ? []
        : Array.from(
              new Set([
                  ...allowedPaths,
                  ...visibleRoots.map((root) => `/${root.id}`),
              ])
          )

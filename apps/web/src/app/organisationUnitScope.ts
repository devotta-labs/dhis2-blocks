import type { OrganisationUnitReference } from './OrganisationUnitPicker'

export interface UserOrganisationUnitScope {
    organisationUnits: OrganisationUnitReference[]
    teiSearchOrganisationUnits?: OrganisationUnitReference[]
}

/**
 * Capture uses Tracker search organisation units when they are configured.
 * Older servers and users without a dedicated search scope fall back to the
 * user's data-capture organisation units.
 */
export const resolveTrackerSearchRoots = ({
    organisationUnits,
    teiSearchOrganisationUnits,
}: UserOrganisationUnitScope): OrganisationUnitReference[] =>
    teiSearchOrganisationUnits?.length
        ? teiSearchOrganisationUnits
        : organisationUnits

export const areOrganisationUnitPathsRelated = (left: string, right: string) =>
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)

export interface OrganisationUnitScopeIntersection {
    allowedPaths: string[]
    pickerRoots: OrganisationUnitReference[]
}

/**
 * The selectable tree is the intersection of the user's Tracker search scope
 * and the organisation units assigned to the selected program.
 */
export const intersectOrganisationUnitScopes = (
    searchRoots: OrganisationUnitReference[],
    programOrganisationUnits: OrganisationUnitReference[]
): OrganisationUnitScopeIntersection => ({
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

export const isOrganisationUnitInScope = (
    selected: OrganisationUnitReference | undefined,
    searchRoots: OrganisationUnitReference[],
    programOrganisationUnits: OrganisationUnitReference[]
) =>
    Boolean(
        selected &&
        searchRoots.some(
            (root) =>
                selected.path === root.path ||
                selected.path.startsWith(`${root.path}/`)
        ) &&
        programOrganisationUnits.some(
            (root) =>
                selected.path === root.path ||
                selected.path.startsWith(`${root.path}/`)
        )
    )

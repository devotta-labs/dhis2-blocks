export interface OrganisationUnitReference {
    id: string
    displayName: string
    path: string
}

export interface UserOrganisationUnitScope {
    organisationUnits: OrganisationUnitReference[]
    teiSearchOrganisationUnits?: OrganisationUnitReference[]
}

/** Capture's top-bar OrgUnitField starts from the user's capture roots. */
export const resolveCaptureOrganisationUnitRoots = ({
    organisationUnits,
}: UserOrganisationUnitScope): OrganisationUnitReference[] => organisationUnits

export const areOrganisationUnitPathsRelated = (left: string, right: string) =>
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)

export interface OrganisationUnitScopeIntersection {
    allowedPaths: string[]
    pickerRoots: OrganisationUnitReference[]
}

/** Capture's quick selector shows every organisation unit in the user's data-entry scope. */
export const getCaptureOrganisationUnitPickerScope = (
    roots: OrganisationUnitReference[]
): OrganisationUnitScopeIntersection => ({
    // An empty filter lets @dhis2/ui load every descendant of the user's
    // capture roots. Supplying only the root paths hides all child nodes.
    allowedPaths: [],
    pickerRoots: roots,
})

/**
 * The selectable tree is the intersection of Capture's data-entry roots and
 * the organisation units assigned to the selected program.
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
            (root) => selected.id === root.id || selected.path === root.path
        )
    )

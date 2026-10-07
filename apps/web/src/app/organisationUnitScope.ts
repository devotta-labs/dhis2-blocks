export interface OrganisationUnitReference {
    id: string
    displayName: string
    path: string
}

export interface UserOrganisationUnitScope {
    organisationUnits: OrganisationUnitReference[]
    teiSearchOrganisationUnits?: OrganisationUnitReference[]
}

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

export const getCaptureOrganisationUnitPickerScope = (
    roots: OrganisationUnitReference[]
): OrganisationUnitScopeIntersection => ({
    allowedPaths: [],
    pickerRoots: roots,
})

export const intersectOrganisationUnitScopes = (
    searchRoots: OrganisationUnitReference[],
    programOrganisationUnits: OrganisationUnitReference[]
): OrganisationUnitScopeIntersection => ({
    allowedPaths: programOrganisationUnits.flatMap((programUnit) =>
        searchRoots.some((searchRoot) =>
            areOrganisationUnitPathsRelated(programUnit.path, searchRoot.path)
        )
            ? [programUnit.path]
            : []
    ),
    pickerRoots: searchRoots.filter((searchRoot) =>
        programOrganisationUnits.some((programUnit) =>
            areOrganisationUnitPathsRelated(programUnit.path, searchRoot.path)
        )
    ),
})

export const isOrganisationUnitWithinRoots = (
    unit: OrganisationUnitReference,
    roots: OrganisationUnitReference[]
) =>
    roots.some(
        (root) =>
            unit.path === root.path || unit.path.startsWith(`${root.path}/`)
    )

export const isOrganisationUnitInScope = (
    selected: OrganisationUnitReference | undefined,
    searchRoots: OrganisationUnitReference[],
    programOrganisationUnits: OrganisationUnitReference[]
) =>
    Boolean(
        selected &&
        isOrganisationUnitWithinRoots(selected, searchRoots) &&
        programOrganisationUnits.some(
            (root) =>
                selected.id === root.id ||
                selected.path === root.path ||
                selected.path.startsWith(`${root.path}/`)
        )
    )

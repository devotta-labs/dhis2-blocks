export interface OrganisationUnitReference {
    id: string
    displayName: string
    path: string
}

export interface UserOrganisationUnitScope {
    organisationUnits: OrganisationUnitReference[]
}

export const resolveCaptureOrganisationUnitRoots = ({
    organisationUnits,
}: UserOrganisationUnitScope): OrganisationUnitReference[] => organisationUnits

export const isOrganisationUnitInScope = (
    selected: { id?: string; path: string } | undefined,
    searchRoots: OrganisationUnitReference[],
    programOrganisationUnits: Array<{ id: string; path: string }>
) =>
    Boolean(
        selected &&
        searchRoots.some(
            (root) =>
                selected.path === root.path ||
                selected.path.startsWith(`${root.path}/`)
        ) &&
        isOrganisationUnitAssigned(selected, programOrganisationUnits)
    )

export const isOrganisationUnitAssigned = (
    selected: { id?: string; path: string },
    assignments: Array<{ id: string; path: string }>
) =>
    assignments.some((unit) =>
        selected.id ? unit.id === selected.id : unit.path === selected.path
    )

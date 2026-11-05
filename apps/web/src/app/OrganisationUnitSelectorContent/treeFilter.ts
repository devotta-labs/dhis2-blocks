import type { OrganisationUnitReference } from '../organisationUnitScope'

export const getOrganisationUnitAncestorPaths = (path?: string) => {
    const segments = path?.split('/').filter(Boolean) ?? []
    return segments.map(
        (_, index) => `/${segments.slice(0, index + 1).join('/')}`
    )
}

export const getInitialOrganisationUnitExpandedPaths = (
    roots: OrganisationUnitReference[],
    selectedPath?: string
) =>
    Array.from(
        new Set([
            ...(roots.length === 1
                ? [`/${roots[0].id}`]
                : roots.map((root) => root.path)),
            ...getOrganisationUnitAncestorPaths(selectedPath),
        ])
    )

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

/**
 * @dhis2/ui filters root IDs against `/${rootId}` before it loads their real
 * paths. Retain each visible root explicitly while keeping the full scope
 * paths that constrain the loaded tree nodes.
 */
export const buildOrganisationUnitTreeFilter = (
    allowedPaths: string[],
    visibleRoots: OrganisationUnitReference[]
) => {
    if (allowedPaths.length === 0) {
        return []
    }

    return Array.from(
        new Set([...allowedPaths, ...visibleRoots.map((root) => `/${root.id}`)])
    )
}

import {
    getInitialOrganisationUnitExpandedPaths,
    getOrganisationUnitAncestorPaths,
} from './treeFilter'

const organisationUnit = (id: string, path: string) => ({
    id,
    displayName: id,
    path,
})

describe('organisation-unit tree expansion', () => {
    it('expands every ancestor of the committed selection', () => {
        expect(
            getOrganisationUnitAncestorPaths(
                '/global/district/facility/program-child'
            )
        ).toEqual([
            '/global',
            '/global/district',
            '/global/district/facility',
            '/global/district/facility/program-child',
        ])
    })

    it('uses Capture root-relative expansion for one nested tree root', () => {
        expect(
            getInitialOrganisationUnitExpandedPaths([
                organisationUnit('facility', '/global/district/facility'),
            ])
        ).toEqual(['/facility'])
    })
})

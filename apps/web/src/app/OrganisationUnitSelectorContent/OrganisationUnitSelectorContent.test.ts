import {
    buildOrganisationUnitTreeFilter,
    getInitialOrganisationUnitExpandedPaths,
    getOrganisationUnitAncestorPaths,
} from './treeFilter'

const organisationUnit = (id: string, path: string) => ({
    id,
    displayName: id,
    path,
})

describe('buildOrganisationUnitTreeFilter', () => {
    it('retains nested user and server-search roots alongside full scope paths', () => {
        const allowedPaths = ['/global/district/facility/program-child']
        const nestedUserRoot = organisationUnit(
            'facility',
            '/global/district/facility'
        )
        const searchResultRoot = organisationUnit(
            'program-child',
            '/global/district/facility/program-child'
        )

        expect(
            buildOrganisationUnitTreeFilter(allowedPaths, [nestedUserRoot])
        ).toEqual(['/global/district/facility/program-child', '/facility'])
        expect(
            buildOrganisationUnitTreeFilter(allowedPaths, [searchResultRoot])
        ).toEqual(['/global/district/facility/program-child', '/program-child'])
    })

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

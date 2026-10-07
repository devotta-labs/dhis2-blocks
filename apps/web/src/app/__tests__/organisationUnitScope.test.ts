import {
    areOrganisationUnitPathsRelated,
    getCaptureOrganisationUnitPickerScope,
    intersectOrganisationUnitScopes,
    isOrganisationUnitInScope,
    resolveCaptureOrganisationUnitRoots,
    type OrganisationUnitReference,
} from '../organisationUnitScope'

describe('areOrganisationUnitPathsRelated', () => {
    it('matches the same unit and either ancestor direction without prefix collisions', () => {
        expect(areOrganisationUnitPathsRelated('/a/b', '/a/b')).toBe(true)
        expect(areOrganisationUnitPathsRelated('/a/b/c', '/a/b')).toBe(true)
        expect(areOrganisationUnitPathsRelated('/a/b', '/a/b/c')).toBe(true)
        expect(areOrganisationUnitPathsRelated('/a/bb', '/a/b')).toBe(false)
    })
})

const unit = (id: string, path: string): OrganisationUnitReference => ({
    id,
    displayName: id,
    path,
})

describe('Capture organisation-unit scope', () => {
    const captureRoot = unit('capture', '/root/capture')
    const searchRoot = unit('search', '/root/capture/search')
    const programRoot = unit('program', '/root/capture/search/program')

    it('uses Capture data-entry roots even when Tracker search roots differ', () => {
        expect(
            resolveCaptureOrganisationUnitRoots({
                organisationUnits: [captureRoot],
                teiSearchOrganisationUnits: [searchRoot],
            })
        ).toEqual([captureRoot])
    })

    it('uses capture organisation units when no search roots exist', () => {
        expect(
            resolveCaptureOrganisationUnitRoots({
                organisationUnits: [captureRoot],
                teiSearchOrganisationUnits: [],
            })
        ).toEqual([captureRoot])
        expect(
            resolveCaptureOrganisationUnitRoots({
                organisationUnits: [captureRoot],
            })
        ).toEqual([captureRoot])
    })

    it('keeps the full user scope in the quick selector regardless of program assignments', () => {
        const outsideProgram = unit('outside', '/root/outside')

        expect(
            getCaptureOrganisationUnitPickerScope([searchRoot, outsideProgram])
        ).toEqual({
            allowedPaths: [],
            pickerRoots: [searchRoot, outsideProgram],
        })
    })

    it('intersects Capture roots with the selected program scope', () => {
        const outsideProgram = unit('outside', '/root/outside')

        const intersection = intersectOrganisationUnitScopes(
            [searchRoot, outsideProgram],
            [programRoot]
        )

        expect(intersection).toEqual({
            allowedPaths: [programRoot.path],
            pickerRoots: [searchRoot],
        })
        expect(
            isOrganisationUnitInScope(programRoot, [searchRoot], [programRoot])
        ).toBe(true)
        expect(
            isOrganisationUnitInScope(
                unit('descendant', `${programRoot.path}/descendant`),
                [searchRoot],
                [programRoot]
            )
        ).toBe(false)
        expect(
            isOrganisationUnitInScope(searchRoot, [searchRoot], [programRoot])
        ).toBe(false)
        expect(
            isOrganisationUnitInScope(
                outsideProgram,
                [searchRoot],
                [programRoot]
            )
        ).toBe(false)
        expect(
            isOrganisationUnitInScope(undefined, [searchRoot], [programRoot])
        ).toBe(false)
    })
})

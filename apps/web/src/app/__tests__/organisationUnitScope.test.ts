import {
    isOrganisationUnitInScope,
    resolveCaptureOrganisationUnitRoots,
    type OrganisationUnitReference,
} from '../organisationUnitScope'

const unit = (id: string, path: string): OrganisationUnitReference => ({
    id,
    displayName: id,
    path,
})

describe('Capture organisation-unit scope', () => {
    const captureRoot = unit('capture', '/root/capture')
    const searchRoot = unit('search', '/root/capture/search')
    const programRoot = unit('program', '/root/capture/search/program')
    const currentUser = {
        organisationUnits: [captureRoot],
        teiSearchOrganisationUnits: [searchRoot],
    }

    it('uses Capture data-entry roots even when Tracker search roots differ', () => {
        expect(resolveCaptureOrganisationUnitRoots(currentUser)).toEqual([
            captureRoot,
        ])
    })

    it('uses capture organisation units when no search roots exist', () => {
        const withoutSearchRoots = {
            ...currentUser,
            teiSearchOrganisationUnits: [],
        }
        expect(resolveCaptureOrganisationUnitRoots(withoutSearchRoots)).toEqual(
            [captureRoot]
        )
        expect(
            resolveCaptureOrganisationUnitRoots({
                organisationUnits: [captureRoot],
            })
        ).toEqual([captureRoot])
    })

    it('requires an exact program assignment within the Capture roots', () => {
        const outsideProgram = unit('outside', '/root/outside')
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
            isOrganisationUnitInScope(
                unit('collision', '/root/capture/searching'),
                [searchRoot],
                [unit('collision', '/root/capture/searching')]
            )
        ).toBe(false)
        expect(
            isOrganisationUnitInScope(undefined, [searchRoot], [programRoot])
        ).toBe(false)
    })
})

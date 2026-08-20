import type { OrganisationUnitReference } from '../OrganisationUnitPicker'
import {
    intersectOrganisationUnitScopes,
    isOrganisationUnitInScope,
    resolveTrackerSearchRoots,
} from '../organisationUnitScope'

const unit = (id: string, path: string): OrganisationUnitReference => ({
    id,
    displayName: id,
    path,
})

describe('Tracker organisation-unit scope', () => {
    const captureRoot = unit('capture', '/root/capture')
    const searchRoot = unit('search', '/root/capture/search')
    const programRoot = unit('program', '/root/capture/search/program')

    it('prefers configured Tracker search organisation units', () => {
        expect(
            resolveTrackerSearchRoots({
                organisationUnits: [captureRoot],
                teiSearchOrganisationUnits: [searchRoot],
            })
        ).toEqual([searchRoot])
    })

    it('falls back to capture organisation units when no search roots exist', () => {
        expect(
            resolveTrackerSearchRoots({
                organisationUnits: [captureRoot],
                teiSearchOrganisationUnits: [],
            })
        ).toEqual([captureRoot])
        expect(
            resolveTrackerSearchRoots({
                organisationUnits: [captureRoot],
            })
        ).toEqual([captureRoot])
    })

    it('intersects Tracker search roots with the selected program scope', () => {
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
            isOrganisationUnitInScope(
                unit('selected', `${programRoot.path}/selected`),
                [searchRoot],
                [programRoot]
            )
        ).toBe(true)
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

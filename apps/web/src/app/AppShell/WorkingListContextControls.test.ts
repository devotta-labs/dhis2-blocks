import {
    projectProgramOptions,
    hasCaptureProgramDataReadAccess,
} from './programOptions'

const buildProgramOptions = (
    options: Omit<Parameters<typeof projectProgramOptions>[0], 'captureRoots'>
) => projectProgramOptions({ ...options, captureRoots: [] }).options

describe('buildProgramOptions', () => {
    const programs = [
        {
            id: 'program-a',
            displayName: 'Program A',
            style: { color: '#0f6cbd', icon: 'medicine' },
            organisationUnits: [{ id: 'ou-a', path: '/root/a' }],
            access: { data: { read: true } },
        },
        {
            id: 'program-b',
            displayName: 'Program B',
            organisationUnits: [{ id: 'ou-b', path: '/root/b' }],
            access: { data: { read: true } },
        },
    ]

    it('maps Capture icon URLs and filters programs to the selected OU hierarchy', () => {
        expect(
            buildProgramOptions({
                programs,
                selectedOrganisationUnit: { path: '/root/a' },
                baseUrl: 'https://play.dhis2.org/dev/',
                apiVersion: 43,
            })
        ).toEqual([
            {
                value: 'program-a',
                label: 'Program A',
                icon: {
                    source: 'https://play.dhis2.org/dev/api/43/icons/medicine/icon',
                    color: '#0f6cbd',
                    alternativeText: 'medicine',
                },
            },
        ])
    })

    it('preserves an incompatible committed program for display until the host clears it', () => {
        expect(
            buildProgramOptions({
                programs,
                selectedOrganisationUnit: { path: '/root/outside' },
                selectedProgramId: 'program-a',
                baseUrl: 'https://play.dhis2.org/dev',
                apiVersion: 43,
            })
        ).toEqual([
            expect.objectContaining({
                value: 'program-a',
                label: 'Program A',
                excludeFromMenu: true,
            }),
        ])

        expect(
            buildProgramOptions({
                programs,
                selectedOrganisationUnit: { path: '/root/outside' },
                baseUrl: 'https://play.dhis2.org/dev',
                apiVersion: 43,
            })
        ).toEqual([])
    })

    it('does not treat ancestor or descendant assignments as exact Capture compatibility', () => {
        for (const selectedOrganisationUnitPath of ['/root/a/child', '/root']) {
            expect(
                buildProgramOptions({
                    programs,
                    selectedOrganisationUnit: {
                        path: selectedOrganisationUnitPath,
                    },
                    baseUrl: 'https://play.dhis2.org/dev',
                    apiVersion: 43,
                })
            ).toEqual([])
        }

        expect(
            buildProgramOptions({
                programs,
                selectedOrganisationUnit: {
                    id: 'different-ou',
                    path: '/root/a',
                },
                baseUrl: 'https://play.dhis2.org/dev',
                apiVersion: 43,
            })
        ).toEqual([])
    })

    it('requires Capture data-read access, not only metadata read access', () => {
        expect(
            hasCaptureProgramDataReadAccess({
                ...programs[0],
                access: { data: { read: false } },
            })
        ).toBe(false)
        expect(
            hasCaptureProgramDataReadAccess({
                ...programs[0],
                access: { data: { read: true } },
            })
        ).toBe(true)
        expect(
            hasCaptureProgramDataReadAccess({
                ...programs[0],
                access: undefined,
            })
        ).toBe(false)
    })
})

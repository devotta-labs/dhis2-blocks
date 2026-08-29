import {
    buildProgramOptions,
    hasCaptureProgramDataReadAccess,
} from './programOptions'

describe('buildProgramOptions', () => {
    const programs = [
        {
            id: 'program-a',
            displayName: 'Program A',
            style: { color: '#0f6cbd', icon: 'medicine' },
            organisationUnits: [{ path: '/root/a' }],
            access: { data: { read: true } },
        },
        {
            id: 'program-b',
            displayName: 'Program B',
            organisationUnits: [{ path: '/root/b' }],
            access: { data: { read: true } },
        },
    ]

    it('maps Capture icon URLs and filters programs to the selected OU hierarchy', () => {
        expect(
            buildProgramOptions({
                programs,
                selectedOrganisationUnitPath: '/root/a/child',
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

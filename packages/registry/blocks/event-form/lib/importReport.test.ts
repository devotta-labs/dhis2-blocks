import refusals from '../test/fixtures/refusals-2.42.json'
import { importReportSchema, placeReport, reportIn } from './importReport'

const STAGE = new Map([
    ['labWeight01', 'Weight (kg)'],
    ['labTempC001', 'Temperature (°C)'],
    ['labSexCode1', 'Sex'],
])

interface ErrorReport {
    message: string
    uid?: string
    args?: string[]
}

const report = (errorReports: ErrorReport[]) =>
    importReportSchema.parse({
        status: 'ERROR',
        validationReport: {
            errorReports: errorReports.map((error) => ({
                errorCode: 'E1000',
                trackerType: 'EVENT',
                ...error,
            })),
        },
    })

describe('placeReport', () => {
    it('places an error naming a category option or the combination on the category it stands for', () => {
        const stands = new Map([
            ['labCoPilot1', { fieldId: 'labCatFund1', name: 'Pilot grant' }],
            ['labAocGovFx', { fieldId: 'labCatFund1', name: 'labAocGovFx' }],
        ])
        const fields = new Map([...STAGE, ['labCatFund1', 'Funding']])
        expect(
            placeReport(
                report([
                    {
                        message:
                            'User: `labUser0001` has no write access to CategoryOption: `labCoPilot1`.',
                    },
                    {
                        message:
                            'Could not find CategoryOptionCombo: `labAocGovFx`.',
                    },
                ]),
                fields,
                stands
            ).fieldErrors
        ).toEqual(
            new Map([
                [
                    'labCatFund1',
                    [
                        'User: `labUser0001` has no write access to CategoryOption: `Pilot grant`.',
                        'Could not find CategoryOptionCombo: `labAocGovFx`.',
                    ],
                ],
            ])
        )
    })

    it('places an error naming a stage data element in args on that field', () => {
        expect(
            placeReport(
                report([
                    {
                        message: 'Value is not a valid option',
                        uid: 'labVisit001',
                        args: ['OLD_CODE', 'labSexCode1', 'labVisit001'],
                    },
                ]),
                STAGE
            )
        ).toEqual({
            fieldErrors: new Map([
                ['labSexCode1', ['Value is not a valid option']],
            ]),
            formErrors: [],
        })
    })

    it('finds the data element in the message when args do not name it', () => {
        const placed = placeReport(
            report([
                {
                    message:
                        "Value 'OLD_CODE' is not a valid option for DataElement `labTempC001` with option set",
                    uid: 'labVisit001',
                    args: [],
                },
            ]),
            STAGE
        )
        expect(placed.fieldErrors).toEqual(
            new Map([
                [
                    'labTempC001',
                    [
                        "Value 'OLD_CODE' is not a valid option for DataElement `Temperature (°C)` with option set",
                    ],
                ],
            ])
        )
        expect(placed.formErrors).toEqual([])
    })

    it('never takes the event uid, or an id inside a longer word, for a data element', () => {
        const placed = placeReport(
            report([
                {
                    message: 'Event labVisit001 has no occurredAt',
                    uid: 'labVisit001',
                    args: ['labVisit001', 'labEnrol001'],
                },
                { message: 'xlabWeight01y is odd' },
            ]),
            STAGE
        )
        expect(placed).toEqual({
            fieldErrors: new Map(),
            formErrors: [
                'Event labVisit001 has no occurredAt',
                'xlabWeight01y is odd',
            ],
        })
    })

    it('keeps every error on one field, and the rest for the form', () => {
        expect(
            placeReport(
                report([
                    { message: 'first', args: ['labWeight01'] },
                    { message: 'second', args: ['labWeight01'] },
                    { message: 'about the form' },
                ]),
                STAGE
            )
        ).toEqual({
            fieldErrors: new Map([['labWeight01', ['first', 'second']]]),
            formErrors: ['about the form'],
        })
    })
})

describe('what DHIS2 2.42 refuses', () => {
    const refused = (...codes: Array<keyof typeof refusals>) =>
        importReportSchema.parse({
            status: 'ERROR',
            validationReport: {
                errorReports: codes.map((code) => refusals[code]),
            },
        })
    const INPATIENT = new Map([
        ['qrur9Dvnyt5', 'Age in years'],
        ['oZg33kd9taw', 'Gender'],
        ['msodh3rEMJa', 'Date of discharge'],
    ])
    const PARTNERS = new Map([
        ['LFsZ8v5v7rq', 'Implementing Partner'],
        ['yY2bQYqNt0o', 'Project'],
    ])
    const project = { fieldId: 'yY2bQYqNt0o', name: '' }
    const OPTIONS = new Map([
        [
            'C6nZpLKjEJr',
            {
                fieldId: 'LFsZ8v5v7rq',
                name: 'African Medical and Research Foundation',
            },
        ],
        ['qkPbeWaFsnU', { fieldId: 'yY2bQYqNt0o', name: 'Fixed' }],
        ...[
            ['yMj2MnmNI8L', 'Improve access to medicines'],
            ['i4Nbp8S2G6A', 'Improve access to clean water'],
            ['OUUdG3sdOqb', 'Provide access to primary health care'],
        ].flatMap(([id = '', name = '']) => [
            [id, { ...project, name }] as const,
            [name, { ...project, name }] as const,
        ]),
    ])

    it('places a refused value on the field holding the value it quotes, by its label', () => {
        expect(
            placeReport(
                refused('E1302', 'E1125', 'E1303'),
                INPATIENT,
                new Map(),
                undefined,
                {
                    qrur9Dvnyt5: 'abc',
                    oZg33kd9taw: 'Nope',
                }
            )
        ).toEqual({
            fieldErrors: new Map([
                [
                    'qrur9Dvnyt5',
                    [
                        'DataElement `Age in years` is not valid: `Value type is INTEGER but the value `abc` is not.`.',
                    ],
                ],
                [
                    'oZg33kd9taw',
                    [
                        'Value `Nope` is not a valid option code in OptionSet `pC3N9N77UmT`.',
                    ],
                ],
                [
                    'msodh3rEMJa',
                    [
                        'Mandatory DataElement `Date of discharge` is not present.',
                    ],
                ],
            ]),
            formErrors: [],
        })
    })

    it('keeps a refused value for the form when no one field holds it', () => {
        expect(
            placeReport(refused('E1302'), INPATIENT, new Map(), undefined, {
                qrur9Dvnyt5: 'abc',
                oZg33kd9taw: 'abc',
            }).formErrors
        ).toEqual([refusals.E1302.message])
    })

    it('places category option refusals on their category, by id or by name', () => {
        const placed = placeReport(
            refused(
                'E1056',
                'E1057',
                'E1099',
                'E1117',
                'E1116',
                'E1055',
                'E1000'
            ),
            PARTNERS,
            OPTIONS
        )
        expect(placed.fieldErrors.get('yY2bQYqNt0o')).toEqual([
            refusals.E1056.message,
            refusals.E1057.message,
            'User: `EfLiveUser1` has no write access to CategoryOption: `Improve access to medicines`.',
        ])
        expect(placed.fieldErrors.get('LFsZ8v5v7rq')).toEqual([
            'CategoryOptionCombo not found for CategoryCombo `O4VaNks6tta` and CategoryOptions `[African Medical and Research Foundation, Fixed]`.',
        ])
        expect(placed.formErrors).toEqual([
            refusals.E1116.message,
            refusals.E1055.message,
            'You do not have access to enter data at Ngelehun CHC. (E1000)',
        ])
    })

    const named =
        (...codes: Array<keyof typeof refusals>) =>
        (known: ReadonlyMap<string, string | undefined>) =>
            placeReport(
                refused(...codes),
                INPATIENT,
                new Map(),
                undefined,
                {},
                known
            ).formErrors

    it('says a refused program, org unit or org unit access in plain words, by the names the form knows', () => {
        expect(
            named(
                'E1091',
                'E1029',
                'E1000'
            )(
                new Map([
                    ['bMcwwoVnbSR', 'Malaria testing'],
                    ['eBAyeGv0exc', 'Inpatient care'],
                    ['ImspTQPwCqd', 'Sierra Leone (country)'],
                    ['DiszpKrYNg8', 'Ngelehun'],
                ])
            )
        ).toEqual([
            'You do not have access to enter data for Malaria testing. (E1091)',
            'Sierra Leone (country) is not set up for Inpatient care. (E1029)',
            'You do not have access to enter data at Ngelehun. (E1000)',
        ])
    })

    it('else by the names DHIS2 gives them in the error', () => {
        expect(named('E1091', 'E1029', 'E1000')(new Map())).toEqual([
            'You do not have access to enter data for Malaria testing and surveillance. (E1091)',
            'Sierra Leone is not set up for Inpatient morbidity and mortality. (E1029)',
            'You do not have access to enter data at Ngelehun CHC. (E1000)',
        ])
    })

    it('keeps DHIS2’s text whole without every name, and for any other code', () => {
        const bare = importReportSchema.parse({
            status: 'ERROR',
            validationReport: {
                errorReports: [
                    { ...refusals.E1029, args: [refusals.E1029.args[0]] },
                    { ...refusals.E1091, args: [] },
                    refusals.E1083,
                ],
            },
        })
        expect(
            placeReport(
                bare,
                INPATIENT,
                new Map(),
                undefined,
                {},
                new Map([['otherProgrm', 'Other']])
            ).formErrors
        ).toEqual([
            refusals.E1029.message,
            refusals.E1091.message,
            refusals.E1083.message,
        ])
    })
})

describe('geometry errors', () => {
    const refused = importReportSchema.parse({
        status: 'ERROR',
        validationReport: {
            errorReports: [
                {
                    errorCode: 'E1012',
                    message:
                        'Geometry does not conform to FeatureType: `POINT`.',
                    args: ['POINT'],
                },
            ],
        },
    })

    it('places an error about the geometry on the location when the form shows one', () => {
        expect(placeReport(refused, STAGE, new Map(), 'geometry')).toEqual({
            fieldErrors: new Map([
                [
                    'geometry',
                    ['Geometry does not conform to FeatureType: `POINT`.'],
                ],
            ]),
            formErrors: [],
        })
    })

    it('keeps it for the form otherwise', () => {
        expect(placeReport(refused, STAGE).formErrors).toEqual([
            'Geometry does not conform to FeatureType: `POINT`.',
        ])
    })
})

describe('reportIn', () => {
    const inner = {
        status: 'ERROR',
        validationReport: {
            errorReports: [{ errorCode: 'E1000', message: 'm' }],
        },
    }

    it('finds the report at the top level, else under response', () => {
        expect(reportIn(inner)).toEqual(inner)
        expect(reportIn({ response: inner })).toEqual(inner)
    })

    it('gives nothing for anything else', () => {
        expect(reportIn(null)).toBeUndefined()
        expect(reportIn('boom')).toBeUndefined()
        expect(reportIn({ response: { status: 'OK' } })).toBeUndefined()
    })
})

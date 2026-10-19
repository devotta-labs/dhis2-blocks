import { mapImportReport, parseImportReport } from './importReport'

const STAGE = new Set(['de0FEHSIoxh', 'vANAXwtLwcT', 'NPZPVg2rVh4'])

type ErrorReportFixture = {
    message: string
    errorCode?: string
    trackerType?: string
    uid?: string
    args?: string[]
}

const report = (errorReports: ErrorReportFixture[]) => {
    const parsed = parseImportReport({ validationReport: { errorReports } })
    if (parsed === undefined) {
        throw new Error('Expected a report')
    }
    return parsed
}

describe('mapImportReport', () => {
    it('maps a report naming a stage data element in args to a field error', () => {
        const result = mapImportReport(
            report([
                {
                    message: 'Value is not a valid option',
                    errorCode: 'E1125',
                    trackerType: 'EVENT',
                    uid: 'Evahwp3zrQ4',
                    args: ['OLD_CODE', 'de0FEHSIoxh', 'Evahwp3zrQ4'],
                },
            ]),
            STAGE
        )
        expect(result).toEqual({
            fieldErrors: { de0FEHSIoxh: 'Value is not a valid option' },
            formErrors: [],
        })
    })

    it('maps a report naming the data element only in the message (retired option code)', () => {
        const result = mapImportReport(
            report([
                {
                    message:
                        "Value 'OLD_CODE' is not a valid option for DataElement `vANAXwtLwcT` with option set",
                    errorCode: 'E1125',
                    uid: 'Evahwp3zrQ4',
                    args: [],
                },
            ]),
            STAGE
        )
        expect(Object.keys(result.fieldErrors)).toEqual(['vANAXwtLwcT'])
        expect(result.formErrors).toEqual([])
    })

    it('does not mistake the event uid or other uids for a data element', () => {
        const result = mapImportReport(
            report([
                {
                    message: 'Event Evahwp3zrQ4 has no occurredAt',
                    uid: 'Evahwp3zrQ4',
                    args: ['Evahwp3zrQ4', 'PE6abx7Zhn0'],
                },
            ]),
            STAGE
        )
        expect(result).toEqual({
            fieldErrors: {},
            formErrors: ['Event Evahwp3zrQ4 has no occurredAt'],
        })
    })

    it('does not match a uid embedded in a longer word', () => {
        const result = mapImportReport(
            report([{ message: 'xde0FEHSIoxhy is odd' }]),
            STAGE
        )
        expect(result.fieldErrors).toEqual({})
        expect(result.formErrors).toHaveLength(1)
    })

    it('joins several errors on one field and keeps the rest as form errors', () => {
        const result = mapImportReport(
            report([
                { message: 'first', args: ['de0FEHSIoxh'] },
                { message: 'second', args: ['de0FEHSIoxh'] },
                { message: 'about the form' },
            ]),
            STAGE
        )
        expect(result).toEqual({
            fieldErrors: { de0FEHSIoxh: 'first; second' },
            formErrors: ['about the form'],
        })
    })

    it('has no errors for a report without a validation report', () => {
        expect(mapImportReport({}, STAGE)).toEqual({
            fieldErrors: {},
            formErrors: [],
        })
    })
})

describe('parseImportReport', () => {
    it('finds the report at the top level and under response', () => {
        const inner = { validationReport: { errorReports: [{ message: 'm' }] } }
        const expected = [{ message: 'm', args: [] }]
        expect(
            parseImportReport(inner)?.validationReport?.errorReports
        ).toEqual(expected)
        expect(
            parseImportReport({ response: inner })?.validationReport
                ?.errorReports
        ).toEqual(expected)
    })

    it('returns undefined for anything else', () => {
        expect(parseImportReport(undefined)).toBeUndefined()
        expect(parseImportReport('boom')).toBeUndefined()
        expect(
            parseImportReport({ response: { status: 'OK' } })
        ).toBeUndefined()
    })
})

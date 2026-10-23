import type { ProfileValueType } from '../../types'
import type { FormattableValue } from './contracts'
import {
    createValueFormatter,
    formatValue,
    type FormatContext,
} from './formatValue'

const context: FormatContext = {
    systemInfo: { calendar: 'iso8601', dateFormat: 'DD-MM-YYYY' },
    api: { baseUrl: 'https://play.dhis2.test/', apiVersion: 43 },
    fileResourceNames: new Map([['FileResour1', 'consent.pdf']]),
    organisationUnits: new Map([
        [
            'DiszpKrYNg8',
            { name: 'Ngelehun CHC', path: ['Sierra Leone', 'Bo', 'Badjia'] },
        ],
    ]),
}

const value = (
    valueType: ProfileValueType,
    rawValue: string | null,
    extra: Partial<FormattableValue> = {}
): FormattableValue => ({ valueType, rawValue, label: 'Field', ...extra })

const format = (
    valueType: ProfileValueType,
    rawValue: string | null,
    extra: Partial<FormattableValue> = {}
) => formatValue(value(valueType, rawValue, extra), context)

const FILE = {
    endpoint: 'tracker/trackedEntities/PQfMcpmXeFE/attributes/DocumentAt1',
    params: { program: 'IpHINAT79UW' },
}

describe('formatValue (Capture clientToView parity)', () => {
    it.each([null, ''])('renders %j as empty', (rawValue) => {
        expect(format('TEXT', rawValue)).toEqual({ kind: 'empty' })
        expect(format('BOOLEAN', rawValue)).toEqual({ kind: 'empty' })
    })

    it.each([
        'TEXT',
        'LONG_TEXT',
        'LETTER',
        'PHONE_NUMBER',
        'EMAIL',
        'URL',
        'USERNAME',
        'TIME',
        'UNIT_INTERVAL',
        'TRACKER_ASSOCIATE',
        'REFERENCE',
        'MULTI_TEXT',
    ] as const)('shows %s values as-is', (valueType) => {
        expect(format(valueType, ' raw value ')).toEqual({
            kind: 'text',
            text: ' raw value ',
        })
    })

    it.each([
        ['NUMBER', '1.50', '1.5'],
        ['NUMBER', '1,5', '1.5'],
        ['INTEGER', '007', '7'],
        ['INTEGER_POSITIVE', '12', '12'],
        ['INTEGER_NEGATIVE', '-3', '-3'],
        ['INTEGER_ZERO_OR_POSITIVE', '0', '0'],
        ['PERCENTAGE', '42', '42 %'],
        ['NUMBER', 'abc', 'abc'],
    ] as const)('formats %s %j as %j', (valueType, rawValue, expected) => {
        expect(format(valueType, rawValue)).toEqual({
            kind: 'text',
            text: expected,
        })
    })

    it('formats DATE and AGE in the system calendar and date format', () => {
        expect(format('DATE', '2024-03-01')).toEqual({
            kind: 'text',
            text: '01-03-2024',
        })
        expect(format('AGE', '2020-02-29T00:00:00.000')).toEqual({
            kind: 'text',
            text: '29-02-2020',
        })
    })

    it('formats DATETIME with HH:mm', () => {
        expect(format('DATETIME', '2024-03-01T14:05:00.000')).toEqual({
            kind: 'text',
            text: '01-03-2024 14:05',
        })
    })

    it('falls back to the raw value for unparseable dates', () => {
        expect(format('DATE', 'yesterday')).toEqual({
            kind: 'text',
            text: 'yesterday',
        })
    })

    it('shows BOOLEAN as Yes/No and TRUE_ONLY as Yes', () => {
        expect(format('BOOLEAN', 'true')).toEqual({ kind: 'text', text: 'Yes' })
        expect(format('BOOLEAN', 'false')).toEqual({ kind: 'text', text: 'No' })
        expect(format('TRUE_ONLY', 'true')).toEqual({
            kind: 'text',
            text: 'Yes',
        })
        expect(format('TRUE_ONLY', 'false')).toEqual({ kind: 'empty' })
    })

    it('parses COORDINATE as [longitude, latitude]', () => {
        expect(format('COORDINATE', '[-11.83, 8.05]')).toEqual({
            kind: 'coordinate',
            latitude: 8.05,
            longitude: -11.83,
        })
        expect(format('COORDINATE', 'nonsense')).toEqual({
            kind: 'text',
            text: 'nonsense',
        })
    })

    it('shows GEOJSON polygons as Polygon and points as coordinates', () => {
        expect(
            format(
                'GEOJSON',
                '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}'
            )
        ).toEqual({ kind: 'polygon' })
        expect(
            format('GEOJSON', '{"type":"Point","coordinates":[-11.83,8.05]}')
        ).toEqual({ kind: 'coordinate', latitude: 8.05, longitude: -11.83 })
        expect(format('GEOJSON', '{oops')).toEqual({
            kind: 'text',
            text: '{oops',
        })
    })

    it('shows option names, in place of the code, for any value type', () => {
        const options = [
            { code: 'Male', displayName: 'Male (M)' },
            { code: 'Female', displayName: 'Female (F)' },
        ]
        expect(format('TEXT', 'Female', { options })).toEqual({
            kind: 'text',
            text: 'Female (F)',
        })
        expect(format('TEXT', 'Unknown', { options })).toEqual({
            kind: 'text',
            text: 'Unknown',
        })
    })

    it('matches numeric option codes by value', () => {
        expect(
            format('INTEGER', '1', {
                options: [{ code: '1.0', displayName: 'One' }],
            })
        ).toEqual({ kind: 'text', text: 'One' })
    })

    it('joins MULTI_TEXT option names with a comma', () => {
        expect(
            format('MULTI_TEXT', 'A,C', {
                options: [
                    { code: 'A', displayName: 'Alpha' },
                    { code: 'B', displayName: 'Beta' },
                    { code: 'C', displayName: 'Gamma' },
                ],
            })
        ).toEqual({ kind: 'text', text: 'Alpha, Gamma' })
    })

    it('links FILE_RESOURCE values by name, with ?program= when given', () => {
        expect(format('FILE_RESOURCE', 'FileResour1', { file: FILE })).toEqual({
            kind: 'file',
            name: 'consent.pdf',
            href: 'https://play.dhis2.test/api/43/tracker/trackedEntities/PQfMcpmXeFE/attributes/DocumentAt1/file?program=IpHINAT79UW',
        })
        expect(
            format('FILE_RESOURCE', 'FileResour1', {
                file: { endpoint: FILE.endpoint },
            })
        ).toEqual({
            kind: 'file',
            name: 'consent.pdf',
            href: 'https://play.dhis2.test/api/43/tracker/trackedEntities/PQfMcpmXeFE/attributes/DocumentAt1/file',
        })
    })

    it('blanks a file whose resource could not be resolved', () => {
        expect(format('FILE_RESOURCE', 'MissingFile', { file: FILE })).toEqual({
            kind: 'empty',
        })
    })

    it('blanks a file whose resource has no name', () => {
        expect(
            formatValue(value('FILE_RESOURCE', 'Nameless01', { file: FILE }), {
                ...context,
                fileResourceNames: new Map([['Nameless01', '']]),
            })
        ).toEqual({ kind: 'empty' })
    })

    it('renders files as text without a file endpoint', () => {
        expect(format('FILE_RESOURCE', 'FileResour1')).toEqual({
            kind: 'text',
            text: 'consent.pdf',
        })
        expect(format('IMAGE', 'ImageFile01')).toEqual({
            kind: 'text',
            text: 'ImageFile01',
        })
    })

    it('builds IMAGE full and small preview hrefs, naming the field in alt', () => {
        expect(
            format('IMAGE', 'ImageFile01', {
                label: 'Photo',
                file: {
                    endpoint:
                        'tracker/trackedEntities/PQfMcpmXeFE/attributes/PhotoAttr01',
                },
            })
        ).toEqual({
            kind: 'image',
            href: 'https://play.dhis2.test/api/43/tracker/trackedEntities/PQfMcpmXeFE/attributes/PhotoAttr01/image',
            previewHref:
                'https://play.dhis2.test/api/43/tracker/trackedEntities/PQfMcpmXeFE/attributes/PhotoAttr01/image?dimension=small',
            alt: 'Photo',
        })
        expect(
            format('IMAGE', 'ImageFile01', {
                file: { ...FILE, endpoint: `${FILE.endpoint}x` },
            })
        ).toMatchObject({
            previewHref:
                'https://play.dhis2.test/api/43/tracker/trackedEntities/PQfMcpmXeFE/attributes/DocumentAt1x/image?program=IpHINAT79UW&dimension=small',
        })
    })

    it('shows org units by name with their ancestor path', () => {
        expect(format('ORGANISATION_UNIT', 'DiszpKrYNg8')).toEqual({
            kind: 'organisationUnit',
            name: 'Ngelehun CHC',
            path: ['Sierra Leone', 'Bo', 'Badjia'],
        })
        expect(format('ORGANISATION_UNIT', 'Unknown0001')).toEqual({
            kind: 'text',
            text: 'Unknown0001',
        })
    })
})

describe('createValueFormatter', () => {
    it('formats values and changelog timestamps with the same context', () => {
        const formatter = createValueFormatter(context)
        expect(formatter.format(value('DATE', '2024-03-01'))).toEqual({
            kind: 'text',
            text: '01-03-2024',
        })
        expect(formatter.formatDateTime('2024-03-01T09:41:12.345')).toBe(
            '01-03-2024 09:41'
        )
        expect(formatter.formatDateTime('garbage')).toBe('garbage')
    })
})

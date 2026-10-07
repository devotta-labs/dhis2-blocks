import { resolveWorkingListCapabilities } from '../api/capabilities'
import type { WorkingListField } from '../domain/model'
import {
    getCellDisplayValue,
    getValueTypeDefinition,
    validateAppliedFilter,
} from './valueTypes'

const field = (
    valueType: WorkingListField['valueType'],
    overrides: Partial<WorkingListField> = {}
): WorkingListField => ({
    id: `Field${valueType}`,
    displayName: valueType,
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType,
    filterable: true,
    ...overrides,
})

const capabilities = resolveWorkingListCapabilities({ apiVersion: 43 })

describe('value-type registry boundary validation', () => {
    it.each([
        ['INTEGER', '4', 4],
        ['INTEGER_POSITIVE', 1, 1],
        ['INTEGER_NEGATIVE', -1, -1],
        ['INTEGER_ZERO_OR_POSITIVE', 0, 0],
        ['UNIT_INTERVAL', 0.5, 0.5],
        ['PERCENTAGE', 100, 100],
    ] as const)('parses valid %s values', (valueType, input, output) => {
        expect(getValueTypeDefinition(valueType).parseServerValue(input)).toBe(
            output
        )
    })

    it.each([
        ['INTEGER', 1.5],
        ['INTEGER_POSITIVE', 0],
        ['INTEGER_NEGATIVE', 0],
        ['INTEGER_ZERO_OR_POSITIVE', -1],
        ['UNIT_INTERVAL', 1.1],
        ['PERCENTAGE', 101],
        ['NUMBER', ''],
    ] as const)('rejects out-of-domain %s values', (valueType, input) => {
        expect(() =>
            getValueTypeDefinition(valueType).parseServerValue(input)
        ).toThrow()
    })

    it('rejects reversed or subtype-invalid numeric editor ranges', () => {
        const definition = getValueTypeDefinition('INTEGER_POSITIVE')

        expect(() =>
            definition.parseEditorValue({
                kind: 'numberRange',
                min: 5,
                max: 2,
            })
        ).toThrow('minimum cannot exceed')
        expect(() =>
            definition.parseEditorValue({ kind: 'numberRange', min: -1 })
        ).toThrow('greater than zero')
    })

    it.each([
        ['LETTER', 'AB'],
        ['EMAIL', 'not-an-email'],
        ['URL', 'javascript:alert(1)'],
        ['COORDINATE', '[200,95]'],
        ['FILE_RESOURCE', 'not-a-uid'],
        ['ORGANISATION_UNIT', 'not-a-uid'],
    ] as const)('rejects malformed %s values', (valueType, input) => {
        expect(() =>
            getValueTypeDefinition(valueType).parseServerValue(input)
        ).toThrow()
    })

    it('validates date, datetime, and time server shapes', () => {
        expect(
            getValueTypeDefinition('DATE').parseServerValue('2024-02-29')
        ).toBe('2024-02-29')
        expect(
            getValueTypeDefinition('DATE').parseServerValue(
                '2024-02-29T00:00:00.000'
            )
        ).toBe('2024-02-29T00:00:00.000')
        expect(
            getValueTypeDefinition('DATETIME').parseServerValue(
                '2024-02-29T23:59:59.000Z'
            )
        ).toBe('2024-02-29T23:59:59.000Z')
        expect(
            getValueTypeDefinition('TIME').parseServerValue('23:59:59')
        ).toBe('23:59:59')

        expect(() =>
            getValueTypeDefinition('DATE').parseServerValue('2023-02-29')
        ).toThrow()
        expect(() =>
            getValueTypeDefinition('DATETIME').parseServerValue('2024-02-29')
        ).toThrow()
        expect(() =>
            getValueTypeDefinition('TIME').parseServerValue('24:00')
        ).toThrow()
    })

    it('enforces TRUE_ONLY at the server boundary', () => {
        expect(
            getValueTypeDefinition('TRUE_ONLY').parseServerValue('true')
        ).toBe(true)
        expect(() =>
            getValueTypeDefinition('TRUE_ONLY').parseServerValue(false)
        ).toThrow('only true')
    })
})

describe('value formatting and filtering contracts', () => {
    it('maps every MULTI_TEXT option code independently', () => {
        const optionField = field('MULTI_TEXT', {
            options: [
                { code: 'A', displayName: 'Alpha' },
                { code: 'B', displayName: 'Beta' },
            ],
        })

        expect(
            getValueTypeDefinition('MULTI_TEXT').format('A,B', optionField)
        ).toBe('Alpha, Beta')
    })

    it('returns React-neutral semantic display descriptors', () => {
        expect(
            getCellDisplayValue('https://dhis2.org', field('URL'))
        ).toMatchObject({ kind: 'link', href: 'https://dhis2.org/' })
        expect(
            getCellDisplayValue(
                {
                    id: 'Abcdef12345',
                    url: '/api/tracker/trackedEntities/Tei00000001/attributes/FileAttr001/file?program=Program0001',
                },
                field('FILE_RESOURCE'),
                { resolveFileResourceName: () => 'consent-form.pdf' }
            )
        ).toEqual({
            kind: 'file',
            text: 'consent-form.pdf',
            href: '/api/tracker/trackedEntities/Tei00000001/attributes/FileAttr001/file?program=Program0001',
        })
        // Capture parity: a file whose name cannot be resolved renders empty.
        expect(
            getCellDisplayValue('Abcdef12345', field('FILE_RESOURCE'))
        ).toEqual({ kind: 'empty', text: '' })
        expect(
            getCellDisplayValue(
                {
                    id: 'Abcdef12345',
                    url: '/api/tracker/events/Event000001/dataValues/ImageDe0001/image',
                    previewUrl:
                        '/api/tracker/events/Event000001/dataValues/ImageDe0001/image?dimension=small',
                },
                field('IMAGE')
            )
        ).toEqual({
            kind: 'image',
            alt: '',
            href: '/api/tracker/events/Event000001/dataValues/ImageDe0001/image',
            previewHref:
                '/api/tracker/events/Event000001/dataValues/ImageDe0001/image?dimension=small',
        })
        // A bare UID (no tracker context) falls back to the direct download.
        expect(getCellDisplayValue('Abcdef12345', field('IMAGE'))).toEqual({
            kind: 'image',
            alt: '',
            href: '/api/fileResources/Abcdef12345/data',
            previewHref: '/api/fileResources/Abcdef12345/data',
        })
        expect(
            getCellDisplayValue(
                {
                    id: 'User0000001',
                    name: 'John Traore',
                    username: 'admin',
                },
                field('USERNAME')
            )
        ).toEqual({ kind: 'text', text: 'John Traore (admin)' })
        expect(
            getCellDisplayValue('[12.5,7.25]', field('COORDINATE'))
        ).toMatchObject({
            kind: 'coordinate',
            longitude: 12.5,
            latitude: 7.25,
        })
        expect(
            getCellDisplayValue('OrgUnit0001', field('ORGANISATION_UNIT'), {
                resolveDisplayName: () => 'Ngelehun CHC',
            })
        ).toEqual({
            kind: 'reference',
            id: 'OrgUnit0001',
            referenceType: 'organisationUnit',
            text: 'Ngelehun CHC',
        })
        expect(
            getCellDisplayValue('person@example.org', field('EMAIL'))
        ).toEqual({ kind: 'text', text: 'person@example.org' })
        expect(
            getCellDisplayValue('+47 123 45 678', field('PHONE_NUMBER'))
        ).toEqual({ kind: 'text', text: '+47 123 45 678' })
    })

    it('requires registry-compatible operators, values and option codes', () => {
        const optionField = field('TEXT', {
            optionSetId: 'OptionSet01',
            options: [{ code: 'KNOWN', displayName: 'Known' }],
        })

        expect(() =>
            validateAppliedFilter(
                {
                    field: optionField,
                    operator: 'in',
                    value: { kind: 'options', values: ['MISSING'] },
                },
                capabilities
            )
        ).toThrow('not a known option')
        expect(() =>
            validateAppliedFilter(
                {
                    field: field('INTEGER'),
                    operator: 'range',
                    value: { kind: 'text', value: '4' },
                },
                capabilities
            )
        ).toThrow()
        expect(() =>
            validateAppliedFilter(
                {
                    field: field('TEXT'),
                    operator: 'empty',
                    value: { kind: 'empty', isEmpty: false },
                },
                capabilities
            )
        ).toThrow('matching empty')
    })

    it('round-trips a saved absolute date through transformer hooks', () => {
        const dateField = field('DATE')
        const definition = getValueTypeDefinition('DATE')

        const filter = {
            field: dateField,
            operator: 'range' as const,
            value: {
                kind: 'dateRange' as const,
                mode: 'absolute' as const,
                start: '2083-01-01',
                end: '2083-01-02',
            },
        }

        const saved = definition.serializeSaved(filter, {
            toApiDate: (value) =>
                value === '2083-01-01' ? '2026-04-14' : '2026-04-15',
        })

        expect(saved).toEqual({
            dateFilter: {
                type: 'ABSOLUTE',
                startDate: '2026-04-14',
                endDate: '2026-04-15',
            },
        })
        expect(
            definition.parseSaved(saved, {
                fromApiDate: (value) =>
                    value === '2026-04-14' ? '2083-01-01' : '2083-01-02',
            })
        ).toEqual(filter.value)
    })
})

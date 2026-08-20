import type { WorkingListField } from '../domain/model'
import {
    getAllowedFilterOperators,
    validateAppliedFilter,
} from '../registry/valueTypes'
import { resolveWorkingListCapabilities } from './capabilities'

const field = (
    valueType: WorkingListField['valueType'],
    overrides: Partial<WorkingListField> = {}
): WorkingListField => ({
    id: `field-${valueType}`,
    displayName: valueType,
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType,
    filterable: true,
    ...overrides,
})

describe('working-list capability resolution', () => {
    it.each([
        [41, 'programStatus', false],
        [42, 'enrollmentStatus', true],
        [43, 'enrollmentStatus', true],
        [44, 'enrollmentStatus', true],
    ] as const)(
        'resolves the v%s Tracker contract',
        (apiVersion, enrollmentStatusParameter, emptyValueFilters) => {
            const capabilities = resolveWorkingListCapabilities({ apiVersion })

            expect(capabilities).toMatchObject({
                apiVersion,
                supported: true,
                enrollmentStatusParameter,
                emptyValueFilters,
                multipleOptionValues: true,
            })
        }
    )

    it('marks pre-v41 APIs unsupported', () => {
        expect(
            resolveWorkingListCapabilities({ apiVersion: 40 }).supported
        ).toBe(false)
    })

    it('enables metadata-driven search behavior only when fields are present', () => {
        expect(
            resolveWorkingListCapabilities({
                apiVersion: 43,
                metadataFeatures: {
                    preferredSearchOperator: true,
                    minimumSearchLength: true,
                },
            })
        ).toMatchObject({
            metadataSearchOperators: true,
            minimumSearchLength: true,
        })
    })

    it.each(['COORDINATE', 'FILE_RESOURCE', 'IMAGE', 'URL'] as const)(
        'keeps %s displayable but exposes only empty operators on v42+',
        (valueType) => {
            const v41 = resolveWorkingListCapabilities({ apiVersion: 41 })
            const v42 = resolveWorkingListCapabilities({ apiVersion: 42 })
            const definition = field(valueType)

            expect(v41.supportsValueTypeFilter(valueType)).toBe(false)
            expect(getAllowedFilterOperators(definition, v41)).toEqual([])
            expect(v42.supportsValueTypeFilter(valueType)).toBe(true)
            expect(getAllowedFilterOperators(definition, v42)).toEqual([
                'empty',
                'notEmpty',
            ])
        }
    )

    it('supports multiple option values throughout the supported matrix', () => {
        const optionField = field('MULTI_TEXT', {
            optionSetId: 'optionSet',
            options: [
                { code: 'A', displayName: 'A' },
                { code: 'B', displayName: 'B' },
            ],
        })

        for (const apiVersion of [41, 42, 43, 44]) {
            expect(() =>
                validateAppliedFilter(
                    {
                        field: optionField,
                        operator: 'in',
                        value: { kind: 'options', values: ['A', 'B'] },
                    },
                    resolveWorkingListCapabilities({ apiVersion })
                )
            ).not.toThrow()
        }
    })
})

import { resolveWorkingListCapabilities } from '../api/capabilities'
import type { AppliedFilter, FilterValue } from '../domain/model'
import { FilterValueSchema } from '../domain/schemas'
import {
    getSystemFilterDefinition,
    systemFilterRegistry,
    validateSystemFilter,
} from './systemFilters'

const filter = (
    id: string,
    operator: AppliedFilter['operator'],
    value: FilterValue
): AppliedFilter => {
    const definition = getSystemFilterDefinition(id)

    if (!definition) {
        throw new Error(`Missing ${id}`)
    }

    return { field: definition.field, operator, value }
}

describe('system filter registry', () => {
    it('registers the Capture TE and stage filter catalog', () => {
        expect([...systemFilterRegistry.keys()]).toEqual([
            'enrollmentStatus',
            'enrolledAt',
            'enrollmentOccurredAt',
            'followUp',
            'assignedUser',
            'programStage',
            'eventOccurredAt',
            'eventStatus',
            'eventScheduledAt',
            'eventAssignedUser',
        ])
    })

    it.each([
        ['enrollmentStatus', 'in', { kind: 'options', values: ['ACTIVE'] }],
        [
            'enrolledAt',
            'range',
            {
                kind: 'dateRange',
                mode: 'absolute',
                start: '2026-08-18',
            },
        ],
        [
            'enrollmentOccurredAt',
            'range',
            { kind: 'dateRange', mode: 'relative', period: 'TODAY' },
        ],
        ['followUp', 'equals', { kind: 'boolean', values: [true] }],
        [
            'assignedUser',
            'equals',
            {
                kind: 'assignee',
                mode: 'PROVIDED',
                userIds: ['UserId00001'],
            },
        ],
        [
            'eventOccurredAt',
            'range',
            {
                kind: 'dateRange',
                mode: 'relative',
                startBuffer: -7,
                endBuffer: 0,
            },
        ],
        ['eventStatus', 'in', { kind: 'options', values: ['VISITED'] }],
        [
            'eventScheduledAt',
            'range',
            {
                kind: 'dateRange',
                mode: 'absolute',
                end: '2026-08-18',
            },
        ],
        ['eventAssignedUser', 'equals', { kind: 'assignee', mode: 'CURRENT' }],
    ] as const)(
        'validates the exact %s value contract',
        (id, operator, value) => {
            expect(() =>
                validateSystemFilter(
                    filter(id, operator, FilterValueSchema.parse(value))
                )
            ).not.toThrow()
        }
    )

    it('rejects operators and values the system serializer cannot express', () => {
        expect(() =>
            validateSystemFilter(
                filter('eventStatus', 'empty', {
                    kind: 'empty',
                    isEmpty: true,
                })
            )
        ).toThrow('does not support')
        expect(() =>
            validateSystemFilter(
                filter('enrollmentStatus', 'in', {
                    kind: 'options',
                    values: ['UNKNOWN'],
                })
            )
        ).toThrow('not valid')
        expect(() =>
            validateSystemFilter(
                filter('followUp', 'equals', {
                    kind: 'boolean',
                    values: [true, false],
                })
            )
        ).toThrow('exactly one')
        expect(() =>
            validateSystemFilter(
                filter('assignedUser', 'equals', {
                    kind: 'assignee',
                    mode: 'PROVIDED',
                    userIds: ['bad'],
                })
            )
        ).toThrow('valid DHIS2 user UIDs')
        expect(() =>
            validateSystemFilter(
                filter('programStage', 'equals', {
                    kind: 'text',
                    value: 'ProgramStg1',
                })
            )
        ).toThrow('changes result mode')
    })

    it.each([
        ['enrolledAt', 'enrollmentEnrolledAfter', 'enrollmentEnrolledBefore'],
        [
            'enrollmentOccurredAt',
            'enrollmentOccurredAfter',
            'enrollmentOccurredBefore',
        ],
        ['eventOccurredAt', 'occurredAfter', 'occurredBefore'],
        ['eventScheduledAt', 'scheduledAfter', 'scheduledBefore'],
    ] as const)(
        'preserves DATE validation and query serialization for %s',
        (id, after, before) => {
            const definition = getSystemFilterDefinition(id)

            if (!definition) {
                throw new Error(`Missing ${id}`)
            }

            const appliedFilter = filter(id, 'range', {
                kind: 'dateRange',
                mode: 'absolute',
                start: '2083-01-01',
                end: '2083-01-02',
            })

            expect(() => validateSystemFilter(appliedFilter)).not.toThrow()
            expect(
                definition.toQueryParameters(
                    appliedFilter,
                    resolveWorkingListCapabilities({ apiVersion: 43 }),
                    {
                        toApiDate: (value) =>
                            value === '2083-01-01'
                                ? '2026-04-14'
                                : '2026-04-15',
                    }
                )
            ).toEqual({
                [after]: '2026-04-14',
                [before]: '2026-04-15',
            })
        }
    )

    it('preserves DATE boundary validation for system filters', () => {
        expect(() =>
            validateSystemFilter(
                filter('enrolledAt', 'range', {
                    kind: 'dateRange',
                    mode: 'absolute',
                    start: '2026-04-15',
                    end: '2026-04-14',
                })
            )
        ).toThrow('start cannot exceed')
    })
})

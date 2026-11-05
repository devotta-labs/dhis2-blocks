import { renderHook } from 'vitest-browser-react'
import {
    RMNCH,
    rmnchEnrollmentResponse,
    rmnchResponses,
} from '../__tests__/rmnch'
import { serve } from '../__tests__/serve'
import type { EventsRuleRow } from '../lib'
import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from './enrollment'
import { useEventsRules, type UseEventsRulesOptions } from './useEventsRules'

const person = toRuleEnrollmentData(
    RuleEnrollmentResponseSchema.parse(rmnchEnrollmentResponse)
)
const NEW_PERSON = 'NewPerson01'
const NEW_VISIT = 'NewVisit001'

/** The fixture's first visit as a new person's row, with that person as the grid holds them. */
const newRow = (): EventsRuleRow => {
    const event = person.events.find(({ id }) => id === RMNCH.eventId)
    if (event === undefined) {
        throw new Error(`the RMNCH fixture lost event ${RMNCH.eventId}`)
    }
    return {
        event: { ...event, id: NEW_VISIT },
        enrollmentId: NEW_PERSON,
        enrollment: { ...person.enrollment, id: NEW_PERSON },
    }
}

const options = (
    overrides: Partial<UseEventsRulesOptions> = {}
): UseEventsRulesOptions => ({
    programId: RMNCH.programId,
    programStageIds: [...new Set(person.events.map((e) => e.programStageId))],
    tracker: true,
    enrollmentIds: [RMNCH.enrollmentId],
    newEnrollmentIds: [NEW_PERSON],
    ...overrides,
})

const settle = async (read: () => string) => {
    await expect.poll(read, { timeout: 10_000 }).not.toBe('loading')
}

describe('useEventsRules for people not on the server yet', () => {
    it('never fetches a new person, and evaluates their rows at once', async () => {
        const { queries, wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(
            queries
                .filter(({ name }) => name === 'tracker/enrollments')
                .map(({ query }) => query.params?.enrollments)
        ).toEqual([RMNCH.enrollmentId])
        const { effects, failures } = result.current.rules?.evaluate(
            [newRow()],
            [NEW_VISIT]
        ) ?? { effects: new Map(), failures: new Map() }
        expect([...effects.keys()]).toEqual([NEW_VISIT])
        expect(failures).toEqual(new Map())
    })

    it('adds a new person offline without failing or waiting', async () => {
        const { wrapper, failing } = serve(rmnchResponses)
        const { result, rerender } = await renderHook(
            (props?: { options: UseEventsRulesOptions }) =>
                useEventsRules(props?.options ?? options()),
            {
                wrapper,
                initialProps: { options: options({ newEnrollmentIds: [] }) },
            }
        )
        await settle(() => result.current.status)
        failing.push('tracker/enrollments')
        await rerender({ options: options() })
        await expect
            .poll(
                () =>
                    result.current.rules?.evaluate([newRow()], [NEW_VISIT])
                        .effects.size
            )
            .toBe(1)
        expect(result.current.status).toBe('ready')
    })

    it('needs no request when every person is new', async () => {
        const { requests, wrapper } = serve(rmnchResponses, [
            'tracker/enrollments',
        ])
        const { result } = await renderHook(
            () => useEventsRules(options({ enrollmentIds: [] })),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(requests).not.toContain('tracker/enrollments')
        expect(
            result.current.rules?.evaluate([newRow()], [NEW_VISIT]).effects.size
        ).toBe(1)
    })
})

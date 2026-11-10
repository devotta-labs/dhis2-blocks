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
import { useEventsRules, type EventsRules } from './useEventsRules'

const person = toRuleEnrollmentData(
    RuleEnrollmentResponseSchema.parse(rmnchEnrollmentResponse)
)
const stageIds = [...new Set(person.events.map((e) => e.programStageId))]
const eventIds = person.events.map(({ id }) => id)

/** The fixture's events as rows of `enrollmentId`, the first visit with live values over the server's. */
const rowsOf = (
    live: Record<string, string>,
    enrollmentId: string = RMNCH.enrollmentId
): EventsRuleRow[] =>
    person.events.map((event) => ({
        event:
            event.id === RMNCH.eventId
                ? { ...event, dataValues: { ...event.dataValues, ...live } }
                : event,
        enrollmentId,
    }))

const loadRules = async (enrollmentIds: string[] = [RMNCH.enrollmentId]) => {
    const { wrapper } = serve(rmnchResponses)
    const { result } = await renderHook(
        () =>
            useEventsRules({
                programId: RMNCH.programId,
                programStageIds: stageIds,
                tracker: true,
                enrollmentIds,
            }),
        { wrapper }
    )
    await expect
        .poll(() => result.current.rules, { timeout: 10_000 })
        .toBeDefined()
    const rules = result.current.rules
    if (rules === undefined) {
        throw new Error('the rules did not load')
    }
    return rules
}

/** The worker's answer, once it has started. */
const inBackground = async (
    rules: EventsRules,
    rows: ReadonlyArray<EventsRuleRow>,
    rowIds: ReadonlyArray<string>,
    forMs = 10_000
) => {
    await expect
        .poll(() => rules.evaluateInBackground?.(rows, [], 0), {
            timeout: 10_000,
        })
        .toBeDefined()
    return rules.evaluateInBackground?.(rows, rowIds, forMs)
}

describe('evaluateInBackground', () => {
    it('gives each row the effects the main thread gives it', async () => {
        const rules = await loadRules()
        // A 'true' on the first visit reaches the later visits through the person's other rows.
        for (const chronic of ['true', 'false']) {
            const rows = rowsOf({ [RMNCH.chronic]: chronic })
            const here = rules.evaluate(rows, eventIds)
            expect(here.effects.size).toBe(eventIds.length)
            await expect(inBackground(rules, rows, eventIds)).resolves.toEqual({
                evaluation: here,
                done: eventIds.length,
            })
        }
    })

    it('stops after the time it was given, a row at least, and says how far it got', async () => {
        const rules = await loadRules()
        const rows = rowsOf({})
        const answer = await inBackground(rules, rows, eventIds, 0)
        expect(answer?.done).toBe(1)
        expect([...(answer?.evaluation.effects.keys() ?? [])]).toEqual(
            eventIds.slice(0, 1)
        )
    })

    it('leaves the rows no rule runs for to the main thread', async () => {
        const rules = await loadRules([RMNCH.enrollmentId, 'unknownPe01'])
        // A row that is not in the rows, and the rows of a person the server did not return, which fail.
        const rows = rowsOf({}, 'unknownPe01')
        const rowIds = ['missingRow', ...eventIds]
        expect(rules.evaluate(rows, rowIds).failures.size).toBe(eventIds.length)
        await expect(inBackground(rules, rows, rowIds)).resolves.toEqual({
            evaluation: { effects: new Map(), failures: new Map() },
            done: rowIds.length,
        })
    })
})

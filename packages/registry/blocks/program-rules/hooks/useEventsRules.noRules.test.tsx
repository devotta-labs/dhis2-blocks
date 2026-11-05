import { renderHook } from 'vitest-browser-react'
import { RMNCH, rmnchResponses } from '../__tests__/rmnch'
import { serve } from '../__tests__/serve'
import { emptyEffects, type EventsRuleRow } from '../lib'
import { loadRuleEngine } from './loadRuleEngine'
import { useEventsRules } from './useEventsRules'

// In its own file: the engine is imported once per page, so an import by another test would hide the one checked here.
const engineRequested = () =>
    performance
        .getEntriesByType('resource')
        .some((entry) => entry.name.includes('rule-engine'))

const row: EventsRuleRow = {
    event: {
        id: RMNCH.eventId,
        programStageId: RMNCH.stageId,
        orgUnitId: 'ou',
        status: 'ACTIVE',
        dataValues: { [RMNCH.chronic]: 'true' },
    },
    enrollmentId: RMNCH.enrollmentId,
}

describe('useEventsRules for a program without rules', () => {
    it('is ready without the engine or the people, and gives every row empty effects', async () => {
        const { requests, wrapper } = serve({
            ...rmnchResponses,
            rules: { programRules: [] },
        })
        const { result } = await renderHook(
            () =>
                useEventsRules({
                    programId: RMNCH.programId,
                    programStageIds: [RMNCH.stageId],
                    tracker: true,
                    enrollmentIds: [RMNCH.enrollmentId],
                }),
            { wrapper }
        )
        await expect
            .poll(() => result.current.status, { timeout: 10_000 })
            .toBe('ready')
        expect(engineRequested()).toBe(false)
        expect(requests).toContain('programRules')
        expect(requests).not.toContain('tracker/enrollments')

        const rules = result.current.rules
        if (rules === undefined) {
            throw new Error('the rules did not load')
        }
        const { effects, failures } = rules.evaluate(
            [row],
            [row.event.id, 'notARow']
        )
        expect([...effects.keys()]).toEqual([row.event.id])
        expect(effects.get(row.event.id)).toEqual(emptyEffects())
        expect(failures.size).toBe(0)
        expect(
            rules.rowsAffectedBy([row], row.event.id, RMNCH.chronic)
        ).toEqual([row.event.id])
        expect(rules.invalidRules).toEqual([])
        expect(rules.optionGroupOptions.size).toBe(0)

        // The check above can see the engine: it does once something imports it.
        await loadRuleEngine()
        expect(engineRequested()).toBe(true)
    })
})

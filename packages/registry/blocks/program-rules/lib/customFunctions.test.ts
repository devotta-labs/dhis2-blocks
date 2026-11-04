import * as engine from '@dhis2/rule-engine'
import { z } from 'zod'
import { currentEventVariable, eventInput, programMetadata, rule } from '../__tests__/metadata'
import { buildRuleContext } from './buildContext'
import { evaluateEventRules } from './evaluate'
import { customRuleCallback, defineCustomRuleFunction, overlayCustomRuleEvent } from './customFunctions'
import type { CustomRuleFunctions, TrackedEntityRuleContext } from './customFunctions'

const functions: CustomRuleFunctions = {
    lookup: defineCustomRuleFunction({
        props: z.object({ code: z.string() }),
        returns: 'number',
        evaluate: ({ code }, context) => Number(context.events.find((event) => event.dataValues.test === code)?.dataValues.result) || null,
    }),
}
const metadata = (expression: string) => programMetadata({
    variables: [currentEventVariable('code', 'code')],
    rules: [rule('lookup', 'true', [{ id: 'a', type: 'ASSIGN', dataElementId: 'result', data: expression }])],
})
const snapshot: TrackedEntityRuleContext = {
    currentEvent: eventInput().event, program: programMetadata(), metadata: {}, enrollments: [],
    events: [{ ...eventInput().event, id: 'history', dataValues: { test: 'HB', result: '13.4' } }],
}
const evaluate = (expression: string, registry = functions, code = 'HB') => {
    const context = buildRuleContext(engine, metadata(expression))
    expect(context.invalidRules).toEqual([])
    return evaluateEventRules(engine, context, { ...eventInput({ code }), custom: { functions: registry, context: snapshot } })
}

describe('native custom functions', () => {
    it('evaluates an object prop and returns a correlated sibling value', () => {
        expect(evaluate("custom:number('lookup', {code: #{code}})").assignedValues.get('result')?.value).toBe('13.4')
    })
    it('returns a nullable scalar when there is no matching event', () => {
        expect(evaluate("custom:number('lookup', {code: #{code}})", functions, 'UNKNOWN').assignedValues.get('result')?.value).toBeNull()
    })
    it('rejects unknown props even when the supplied Zod object is not strict', () => {
        expect(() => evaluate("custom:number('lookup', {code: 'HB', typo: true})")).toThrow('typo')
    })
    it('reports a missing registration instead of silently dropping its action', () => {
        expect(() => evaluate("custom:number('missing', {})")).toThrow('not registered')
    })
    it('checks the dispatcher against the registered return type', () => {
        expect(() => evaluate("custom:string('lookup', {code: 'HB'})")).toThrow('not string')
    })
    it.each([NaN, Infinity, 'wrong'])('rejects invalid numeric results: %s', (value) => {
        expect(() => evaluate("custom:number('bad', {})", { bad: { returns: 'number', invoke: () => value } })).toThrow()
    })
    it('propagates callback errors to the caller', () => {
        expect(() => evaluate("custom:number('bad', {})", { bad: { returns: 'number', invoke: () => { throw new Error('unavailable') } } })).toThrow('unavailable')
    })
    it.each(['string', 'boolean'] as const)('supports %s results', (returns) => {
        const value = returns === 'string' ? 'match' : true
        expect(evaluate(`custom:${returns}('value', {})`, { value: { returns, invoke: () => value } }).assignedValues.get('result')?.value).toBe(String(value))
    })
    it('keeps contexts isolated between evaluations', () => {
        const fn = { returns: 'number', invoke: (_props, context) => context.events.length } satisfies CustomRuleFunctions[string]
        const first = customRuleCallback({ functions: { count: fn }, context: snapshot }, eventInput())
        const second = customRuleCallback({ functions: { count: fn }, context: { ...snapshot, events: [] } }, eventInput())
        expect(first('number', 'count', new Map())).toBe(2)
        expect(second('number', 'count', new Map())).toBe(1)
        expect(first('number', 'count', new Map())).toBe(2)
    })
    it('overlays live event values without mutating the fetched history', () => {
        const live = { ...snapshot.events[0]!, dataValues: { test: 'HB', result: '21' } }
        const callback = customRuleCallback({ functions, context: snapshot }, { ...eventInput(), otherEvents: [live] })
        expect(callback('number', 'lookup', new Map([['code', 'HB']]))).toBe(21)
        expect(snapshot.events[0]?.dataValues.result).toBe('13.4')
    })
    it('observes an earlier ASSIGN through the evaluated prop', () => {
        const model = metadata("custom:number('lookup', {code: #{code}})")
        model.rules = [rule('set', 'true', [{ id: 'set', type: 'ASSIGN', content: '#{code}', data: "'HB'" }], { priority: 1 }), ...model.rules.map((entry) => ({ ...entry, priority: 2 }))]
        const context = buildRuleContext(engine, model)
        expect(evaluateEventRules(engine, context, { ...eventInput({ code: 'OLD' }), custom: { functions, context: snapshot } }).assignedValues.get('result')?.value).toBe('13.4')
    })
    it('preserves unrendered values and removes explicitly cleared grid fields', () => {
        const saved = { ...eventInput().event, dataValues: { test: 'HB', result: '13.4', unseen: 'kept' } }
        const edited = { ...saved, dataValues: { test: 'GLUCOSE' }, liveDataElementIds: ['test', 'result'] }
        expect(overlayCustomRuleEvent(saved, edited).dataValues).toEqual({ test: 'GLUCOSE', unseen: 'kept' })
        expect(saved.dataValues.result).toBe('13.4')
    })
})

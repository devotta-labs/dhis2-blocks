import type { ExpressionJs, ExpressionMode } from '@dhis2/rule-engine'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import large from '../__tests__/fixtures/large/bundle.json'
import rmnch from '../__tests__/fixtures/rmnch/programRules.json'
import { expressionReferences, scanExpression } from './scanExpression'

interface ExpressionParser {
    ExpressionJs: typeof ExpressionJs
    ExpressionMode: typeof ExpressionMode
}

// The engine's own collectors live in an internal file that the package's
// exports map does not expose, so only tests reach it, by file path.
const loadExpressionParser = async (): Promise<ExpressionParser> => {
    const entry = createRequire(import.meta.url).resolve('@dhis2/rule-engine')
    const file = join(dirname(entry), 'expression-parser.mjs')
    // SAFETY: expression-parser.mjs is the module rule-engine.d.mts declares ExpressionJs and ExpressionMode for.
    return (await import(pathToFileURL(file).href)) as ExpressionParser
}

describe('scanExpression', () => {
    it('reads variables from #{}, A{} and quoted d2: names in order of appearance', () => {
        expect(
            scanExpression(
                `#{lmp} > 0 && A{mobile} != '' && d2:hasValue('lmp') && d2:countIfValue("x", 1) > 0`
            ).variables
        ).toEqual(['lmp', 'mobile', 'x'])
    })

    it('reads program variables, constants and org unit groups', () => {
        expect(
            scanExpression(
                `V{event_date} != '' && C{Gfd3ppDfq8E} > 1 && d2:inOrgUnitGroup('MCHP')`
            )
        ).toEqual({
            variables: [],
            programVariables: ['event_date'],
            constants: ['Gfd3ppDfq8E'],
            orgUnitGroups: ['MCHP'],
        })
    })

    it('ignores quoted strings that are not variable names', () => {
        expect(
            scanExpression(`d2:validatePattern(A{x}, 'abc') && #{y} == 'z'`)
                .variables
        ).toEqual(['x', 'y'])
    })

    it('reads a d2:hasValue name given as a variable reference', () => {
        expect(scanExpression(`d2:hasValue(#{lmp}) && d2:count(A{x})`)).toEqual(
            {
                variables: ['lmp', 'x'],
                programVariables: [],
                constants: [],
                orgUnitGroups: [],
            }
        )
    })

    it('agrees with the engine parser on RMNCH and the generated fixture', async () => {
        const parser = await loadExpressionParser()
        const expressions = [
            ...rmnch.programRules,
            ...large.fx.programRules,
        ].flatMap((rule) => [
            {
                expression: rule.condition,
                mode: parser.ExpressionMode.RULE_ENGINE_CONDITION,
            },
            ...rule.programRuleActions.flatMap((action) =>
                'data' in action && action.data
                    ? [
                          {
                              expression: action.data,
                              mode: parser.ExpressionMode.RULE_ENGINE_ACTION,
                          },
                      ]
                    : []
            ),
        ])
        let compared = 0
        for (const { expression, mode } of expressions) {
            let parsed: ExpressionJs
            try {
                parsed = new parser.ExpressionJs(expression, mode)
            } catch {
                continue
            }
            const scanned = scanExpression(expression)
            expect(new Set(scanned.variables), expression).toEqual(
                new Set(parsed.collectProgramRuleVariableNames())
            )
            expect(new Set(scanned.programVariables), expression).toEqual(
                new Set(parsed.collectProgramVariablesNames())
            )
            compared += 1
        }
        expect(compared).toBeGreaterThan(300)
    })
})

describe('expressionReferences', () => {
    it('gives each reference its kind, name, span and function', () => {
        const expression = `!#{chronic} && d2:hasValue('lmp') && d2:hasValue(#{edd}) && V{event_date} > C{k} && d2:inOrgUnitGroup("MCHP")`
        const references = expressionReferences(expression)
        expect(
            references.map(({ start, end, ...rest }) => ({
                ...rest,
                text: expression.slice(start, end),
            }))
        ).toEqual([
            { kind: 'variable', name: 'chronic', text: '#{chronic}' },
            {
                kind: 'variable',
                name: 'lmp',
                fn: 'hasValue',
                text: `d2:hasValue('lmp'`,
            },
            {
                kind: 'variable',
                name: 'edd',
                fn: 'hasValue',
                text: 'd2:hasValue(#{edd}',
            },
            {
                kind: 'programVariable',
                name: 'event_date',
                text: 'V{event_date}',
            },
            { kind: 'constant', name: 'k', text: 'C{k}' },
            {
                kind: 'orgUnitGroup',
                name: 'MCHP',
                fn: 'inOrgUnitGroup',
                text: 'd2:inOrgUnitGroup("MCHP"',
            },
        ])
    })

    it('lists a name once per appearance, unlike scanExpression', () => {
        expect(
            expressionReferences('#{a} + #{a}').map(({ name }) => name)
        ).toEqual(['a', 'a'])
    })
})

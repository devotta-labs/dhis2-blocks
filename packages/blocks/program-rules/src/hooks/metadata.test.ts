import { ZodError } from 'zod'
import { rmnchMetadata, rmnchResponses } from '../../test/rmnch'
import { ProgramRulesResponseSchema } from './metadata'

describe('toProgramRulesMetadata', () => {
    it('maps the RMNCH responses into rule metadata', () => {
        const metadata = rmnchMetadata()
        expect(metadata.programId).toBe('WSGAb5XwJ3Y')
        expect(metadata.rules).toHaveLength(18)
        expect(metadata.variables).toHaveLength(24)
        expect(metadata.programStages).toHaveLength(5)
        expect(metadata.user.roleIds).toHaveLength(13)
        expect(metadata.constants).toContainEqual({
            id: 'Gfd3ppDfq8E',
            value: 5,
        })
        expect(metadata.rules[0]?.actions[0]).toEqual({
            id: 'oWFO8OtGZDX',
            type: 'ASSIGN',
            content: undefined,
            displayContent: undefined,
            data: 'd2:weeksBetween(#{lmp},V{event_date})',
            location: undefined,
            dataElementId: 'roKuXYfw1BW',
            attributeId: undefined,
            sectionId: undefined,
            programStageId: undefined,
            option: undefined,
            optionGroup: undefined,
        })
    })

    it('collects each nested option set once', () => {
        const metadata = rmnchMetadata()
        const ids = metadata.optionSets.map((optionSet) => optionSet.id)
        expect(new Set(ids).size).toBe(ids.length)
        const variable = metadata.variables.find((v) => v.name === 'allergies')
        expect(variable?.optionSetId).toBe('R3ShQczKnI9')
        expect(ids).toContain('R3ShQczKnI9')
        expect(variable?.fieldValueType).toBe('TEXT')
    })

    it('rejects a rule action without a type', () => {
        const broken = structuredClone(rmnchResponses)
        Reflect.deleteProperty(
            broken.rules.programRules[0]!.programRuleActions[0]!,
            'programRuleActionType'
        )
        expect(() => ProgramRulesResponseSchema.parse(broken)).toThrow(ZodError)
    })
})

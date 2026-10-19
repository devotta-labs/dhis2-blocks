import { inputContentKey } from './inputKey'
import type { ProgramRulesInput } from './useProgramRules'

const input = (dataValues: Record<string, string>): ProgramRulesInput => ({
    event: {
        id: 'e',
        programStageId: 's',
        orgUnitId: 'ou',
        status: 'ACTIVE',
        dataValues,
    },
})

describe('inputContentKey', () => {
    it('ignores identity and key order', () => {
        expect(inputContentKey(input({ a: '1', b: '2' }))).toBe(
            inputContentKey(input({ b: '2', a: '1' }))
        )
    })

    it('changes when a value changes', () => {
        expect(inputContentKey(input({ a: '1' }))).not.toBe(
            inputContentKey(input({ a: '2' }))
        )
    })

    it('tells missing other events apart from none', () => {
        expect(inputContentKey(input({}))).not.toBe(
            inputContentKey({ ...input({}), otherEvents: [] })
        )
    })
})

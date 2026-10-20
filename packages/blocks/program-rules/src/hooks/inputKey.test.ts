import type { RuleEventInput } from '../index'
import { eventContentKey, supplementContentKey } from './inputKey'

const event = (dataValues: Record<string, string>): RuleEventInput => ({
    id: 'e',
    programStageId: 's',
    orgUnitId: 'ou',
    status: 'ACTIVE',
    dataValues,
})

describe('eventContentKey', () => {
    it('ignores identity and key order', () => {
        expect(eventContentKey(event({ a: '1', b: '2' }))).toBe(
            eventContentKey(event({ b: '2', a: '1' }))
        )
    })

    it('changes when a value changes', () => {
        expect(eventContentKey(event({ a: '1' }))).not.toBe(
            eventContentKey(event({ a: '2' }))
        )
    })
})

describe('supplementContentKey', () => {
    it('tells missing other events apart from none', () => {
        expect(supplementContentKey({})).not.toBe(
            supplementContentKey({ otherEvents: [] })
        )
    })

    it('ignores the identity of equal other events', () => {
        expect(supplementContentKey({ otherEvents: [event({ a: '1' })] })).toBe(
            supplementContentKey({ otherEvents: [event({ a: '1' })] })
        )
    })
})

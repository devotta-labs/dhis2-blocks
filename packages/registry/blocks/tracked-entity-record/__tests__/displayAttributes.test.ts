import { buildRecord } from '../buildRecord'
import { displayAttributes } from '../displayAttributes'
import {
    attributeInfo,
    enrollment,
    enrolled,
    notEnrolled,
    record,
} from './builders'
import { loadFixtures, PRG_OPEN, sourcesFor } from './loadFixtures'

const typeAttributes = [
    attributeInfo('t1', { displayInList: true }),
    attributeInfo('t2'),
]
const programAttributes = [
    attributeInfo('p1'),
    attributeInfo('p2', { displayInList: true }),
    attributeInfo('t1'),
]

const ids = (list: ReturnType<typeof displayAttributes>) =>
    list.map(({ attribute }) => attribute.id)

describe('displayAttributes', () => {
    it('program attributes in program order when enrolled', () => {
        const built = record({
            typeAttributes,
            attributes: { p1: 'one', t1: 'tee' },
            programs: [
                enrolled('prg', [enrollment('e')], {
                    program: { attributes: programAttributes },
                }),
            ],
        })
        const result = displayAttributes(built, 'prg')
        expect(ids(result)).toEqual(['p1', 'p2', 't1'])
        expect(result.map(({ value }) => value)).toEqual([
            'one',
            undefined,
            'tee',
        ])
        expect(result[1]?.attribute.displayInList).toBe(true)
    })

    it('type attributes when not enrolled', () => {
        const built = record({
            typeAttributes,
            attributes: { t2: 'two' },
            programs: [
                notEnrolled('prg', {
                    program: { attributes: programAttributes },
                }),
            ],
        })
        const result = displayAttributes(built, 'prg')
        expect(ids(result)).toEqual(['t1', 't2'])
        expect(result[1]?.value).toBe('two')
    })

    it('type attributes without a program', () => {
        const built = record({ typeAttributes, attributes: { t1: 'one' } })
        expect(ids(displayAttributes(built))).toEqual(['t1', 't2'])
    })

    it('type attributes for a program that is not in the record', () => {
        const built = record({ typeAttributes })
        expect(ids(displayAttributes(built, 'unknown'))).toEqual(['t1', 't2'])
    })

    it('type attributes for an unavailable program', () => {
        const built = record({
            typeAttributes,
            programs: [{ status: 'unavailable', programId: 'prg', debug: 'x' }],
        })
        expect(ids(displayAttributes(built, 'prg'))).toEqual(['t1', 't2'])
    })

    it('onlyDisplayInList filters', () => {
        const built = record({
            typeAttributes,
            programs: [
                enrolled('prg', [enrollment('e')], {
                    program: { attributes: programAttributes },
                }),
            ],
        })
        expect(
            ids(displayAttributes(built, 'prg', { onlyDisplayInList: true }))
        ).toEqual(['p2'])
        expect(
            ids(
                displayAttributes(built, undefined, { onlyDisplayInList: true })
            )
        ).toEqual(['t1'])
    })

    it('lists attributes without a value', () => {
        const result = displayAttributes(record({ typeAttributes }))
        expect(result).toHaveLength(2)
        expect(result.every(({ value }) => value === undefined)).toBe(true)
    })

    it('P1 in Prg001: the program attributes with person values', () => {
        const built = buildRecord(sourcesFor(loadFixtures('v42'), 'P1'))
        const result = displayAttributes(built, PRG_OPEN)
        const program = built.programs.get(PRG_OPEN)
        if (program?.status !== 'enrolled') throw new Error('not enrolled')
        expect(ids(result)).toEqual(
            program.program.attributes.map(({ id }) => id)
        )
        const byId = new Map(
            result.map(({ attribute, value }) => [attribute.id, value])
        )
        expect(byId.get('TrE2eAtt002')).toBe('PID-0001')
        expect(byId.get('TrE2eAtt001')).toBe('Amara')
    })
})

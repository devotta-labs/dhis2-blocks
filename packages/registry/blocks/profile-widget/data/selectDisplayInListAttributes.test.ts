import type { TrackedEntityAttributeField } from '../types'
import { selectDisplayInListAttributes } from './selectDisplayInListAttributes'

const attribute = (
    id: string,
    displayInList: boolean
): TrackedEntityAttributeField => ({
    id,
    label: id,
    valueType: 'TEXT',
    rawValue: null,
    value: { kind: 'empty' },
    origin: 'program',
    displayInList,
    unique: false,
})

describe('selectDisplayInListAttributes', () => {
    it('keeps displayInList attributes in order, including empty ones', () => {
        const a = attribute('a', true)
        const c = attribute('c', true)
        expect(
            selectDisplayInListAttributes([a, attribute('b', false), c])
        ).toEqual([a, c])
    })

    it('returns no rows when nothing is shown in lists', () => {
        expect(selectDisplayInListAttributes([attribute('a', false)])).toEqual(
            []
        )
    })
})

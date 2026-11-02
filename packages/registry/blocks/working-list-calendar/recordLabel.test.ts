import { defaultRecordLabel } from './recordLabel'

const texts = new Map([
    ['village', 'Bo'],
    ['sex', 'Female'],
    ['blank', '   '],
    ['empty', ''],
    ['name', 'Amina'],
])
const cellText = (fieldId: string) => texts.get(fieldId) ?? ''

describe('default record labels', () => {
    it('joins the first two columns in the list order', () => {
        expect(defaultRecordLabel(['village', 'sex', 'name'], cellText)).toBe(
            'Bo Female'
        )
    })

    it('skips columns with no text', () => {
        expect(
            defaultRecordLabel(['empty', 'blank', 'name', 'unknown'], cellText)
        ).toBe('Amina')
    })

    it('is empty when no column has text', () => {
        expect(defaultRecordLabel(['empty', 'blank'], cellText)).toBe('')
        expect(defaultRecordLabel([], cellText)).toBe('')
    })
})

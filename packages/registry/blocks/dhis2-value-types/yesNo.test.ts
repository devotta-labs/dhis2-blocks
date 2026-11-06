import i18n from '@dhis2/d2-i18n'
import { parseTyped, typedText } from './valueTypes'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

test('Yes and No are shown in the language set, and read back', async () => {
    i18n.addResources('xx', 'translation', { Yes: 'Oui', No: 'Non' })
    await i18n.changeLanguage('xx')
    try {
        const field = { valueType: 'BOOLEAN' }
        expect(typedText(field, 'true', GREGORIAN)).toBe('Oui')
        expect(typedText(field, 'false', GREGORIAN)).toBe('Non')
        expect(parseTyped(field, 'oui', GREGORIAN)).toEqual({
            ok: true,
            value: 'true',
        })
        expect(parseTyped(field, 'Non', GREGORIAN)).toEqual({
            ok: true,
            value: 'false',
        })
        expect(parseTyped(field, 'yes', GREGORIAN)).toEqual({
            ok: true,
            value: 'true',
        })
    } finally {
        await i18n.changeLanguage('en')
    }
})

test('a label typed in capitals is read with the casing of the language set', async () => {
    i18n.addResources('tr', 'translation', { Yes: 'Evet', No: 'Hayır' })
    await i18n.changeLanguage('tr')
    try {
        expect(
            parseTyped({ valueType: 'BOOLEAN' }, 'HAYIR', GREGORIAN)
        ).toEqual({ ok: true, value: 'false' })
    } finally {
        await i18n.changeLanguage('en')
    }
})

import i18n from '@dhis2/d2-i18n'

const translations = new Map<string, Map<string, string>>()

i18n.on('loaded', () => translations.clear())

/** Reuses a static label across the grid while it stays in the same language. */
export const translatedText = (key: string) => {
    const language = i18n.language
    let byKey = translations.get(language)
    if (byKey === undefined) {
        byKey = new Map()
        translations.set(language, byKey)
    }
    const cached = byKey.get(key)
    if (cached !== undefined) {
        return cached
    }
    const text = i18n.t(key)
    byKey.set(key, text)
    return text
}

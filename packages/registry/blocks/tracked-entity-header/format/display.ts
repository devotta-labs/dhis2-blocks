import i18n from '@dhis2/d2-i18n'

/**
 * The user's DHIS2 locale as a tag `Intl` accepts. DHIS2 uses underscores
 * (`fr_SN`), which `Intl` rejects; one it still can't read falls back to the
 * browser's locale.
 */
export const displayLocale = (): string | undefined => {
    try {
        return Intl.getCanonicalLocales(i18n.language?.replace(/_/g, '-'))[0]
    } catch {
        return undefined
    }
}

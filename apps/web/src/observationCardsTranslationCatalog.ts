import i18n from '@dhis2/d2-i18n'
/**
 * Literal extraction markers for the observation cards block. The block
 * translates at runtime through `@dhis2/d2-i18n`; d2-app-scripts only
 * discovers literal `i18n.t` calls under this app's `src`. Keep this list in
 * step with the block's own `i18n.t` calls. This function is intentionally
 * never invoked.
 */
export const observationCardsTranslationCatalog = () => [
    i18n.t('{{count}} readings from {{from}} to {{to}}, latest {{latest}}'),
    i18n.t('1 reading on {{date}}, latest {{latest}}'),
    i18n.t("Couldn't load this value"),
    i18n.t('Last recorded over {{days}} days ago'),
    i18n.t('Loading'),
    i18n.t('Never recorded'),
    i18n.t('No'),
    i18n.t('No change since {{date}}'),
    i18n.t('Recorded {{date}} · {{stage}}'),
    i18n.t('Some visits are hidden by your access'),
    i18n.t("This value type can't be shown as a trend"),
    i18n.t("This value type can't be shown here"),
    i18n.t('Yes'),
    i18n.t('▲ {{change}} since {{date}}'),
    i18n.t('▼ {{change}} since {{date}}'),
]

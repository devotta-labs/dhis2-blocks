import i18n from '@dhis2/d2-i18n'

/**
 * Everything the switcher says about the units it lists. Pass whole
 * sentences, translated by the app, so a clinic, a school or a site reads
 * naturally in every language.
 */
export interface OrgUnitSwitcherTexts {
    /** Names the trigger, before the unit's name, as in "School: Bo Primary". */
    label: string
    searchPlaceholder: string
    /** The trigger when no unit is chosen. */
    choose: string
    noneAssigned: string
    loadFailed: string
    /** The heading over the rest of the user's hierarchy. */
    allUnits: string
    noResults: string
    loadingMore: string
    moreFailed: string
    /** Said to screen readers when the unit changes. */
    changed: (name: string) => string
}

const AS_WRITTEN = { escapeValue: false }

export const defaultTexts: () => OrgUnitSwitcherTexts = () => ({
    label: i18n.t('Organisation unit'),
    searchPlaceholder: i18n.t('Search organisation units'),
    choose: i18n.t('Choose an organisation unit'),
    noneAssigned: i18n.t('No organisation unit assigned'),
    loadFailed: i18n.t('Organisation units could not be loaded'),
    allUnits: i18n.t('All organisation units'),
    noResults: i18n.t('No organisation units found'),
    loadingMore: i18n.t('Loading more organisation units'),
    moreFailed: i18n.t(
        'More organisation units could not be loaded. Try again'
    ),
    changed: (name) =>
        i18n.t('Organisation unit changed to {{name}}', {
            name,
            interpolation: AS_WRITTEN,
        }),
})

/** The trigger's accessible name: the label, then the unit's full name. */
export const triggerLabel = (label: string, name: string) =>
    i18n.t('{{label}}: {{name}}', { label, name, interpolation: AS_WRITTEN })

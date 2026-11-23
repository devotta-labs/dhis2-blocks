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

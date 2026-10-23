import i18n from '@dhis2/d2-i18n'

// Extraction markers for the source-installed tracked entity finder and its
// tracked-entity-finder-01 example block. Never invoked.
export const trackedEntityFinderTranslationCatalog = () => [
    i18n.t('Search'),
    i18n.t('Searching…'),
    i18n.t('No one found'),
    i18n.t('Too many matches. Add another detail.'),
    i18n.t("This search isn't set up correctly"),
    i18n.t('Add 1 more detail to search'),
    i18n.t('Add {{count}} more details to search'),
    i18n.t('Searching by {{label}} only'),
    i18n.t('Search by one ID at a time'),
    i18n.t("The search couldn't be loaded"),
    i18n.t("The search couldn't be completed"),
    i18n.t('Enter at least {{count}} characters'),
    i18n.t('Enter a number'),
    i18n.t('Enter a whole number'),
    i18n.t('Enter a valid date'),
    i18n.t('From must not be after To'),
    i18n.t('Any'),
    i18n.t('Yes'),
    i18n.t('No'),
    i18n.t('From'),
    i18n.t('To'),
    i18n.t('Results pages'),
    i18n.t('Previous'),
    i18n.t('Next'),
    i18n.t('Page {{page}}'),
    i18n.t(
        "This form can never search in {{program}}. It has no usable ID field and too few usable fields to reach the program's minimum."
    ),
    i18n.t('`{{attribute}}` is not an attribute of {{program}}.'),
    i18n.t("`{{attribute}}` isn't searchable in {{program}}."),
    i18n.t(
        "`{{attribute}}` ({{label}}) has value type {{valueType}}, which can't be searched in {{program}}."
    ),
    i18n.t(
        "`{{attribute}}` ({{label}}) can't be searched this way in {{program}} because the search operators it needs are blocked."
    ),
    i18n.t(
        "`{{attribute}}` ({{label}}) can't be a range in {{program}}. FinderRangeField works only for number, date and date-time attributes that aren't unique; use FinderField."
    ),
    i18n.t(
        '`{{attribute}}` ({{label}}) is composed both as FinderField and as FinderRangeField under one FinderProvider for {{program}}; they cannot share a value, so use one.'
    ),
    i18n.t('{{label}} (`{{id}}`, unique)'),
    i18n.t('{{label}} (`{{id}}`)'),
    i18n.t('Searchable attributes are {{list}}.'),
    i18n.t('Nothing is searchable.'),
    i18n.t('This program needs 1 detail unless an ID is used.'),
    i18n.t('This program needs {{count}} details unless an ID is used.'),
    i18n.t('No ID?'),
    i18n.t('Search by ID instead'),
]

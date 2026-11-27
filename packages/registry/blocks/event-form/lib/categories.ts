import i18n from '@dhis2/d2-i18n'
import { formatCalendarDate, storedDay } from '@/components/dhis2-value-display'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { Category, CategoryOption, HeldEvent, Values } from './metadata'

/** Where and when the event is, which decides the options it may have. */
export interface OptionScope {
    /** The form's org unit and its ancestors. */
    orgUnits: ReadonlySet<string>
    eventDate: string | undefined
    calendar: Dhis2Calendar
}

const AS_IS = { interpolation: { escapeValue: false } }

const optionProblem = (
    option: CategoryOption,
    { orgUnits, eventDate, calendar }: OptionScope
) => {
    if (!option.canWrite) {
        return i18n.t('You cannot enter data for {{option}}', {
            ...AS_IS,
            option: option.name,
        })
    }
    if (
        option.orgUnitIds.length > 0 &&
        !option.orgUnitIds.some((id) => orgUnits.has(id))
    ) {
        return i18n.t('{{option}} is not used at this org unit', {
            ...AS_IS,
            option: option.name,
        })
    }
    const start = option.startDate && storedDay(option.startDate)
    if (eventDate && start && eventDate < start) {
        return i18n.t('{{option}} starts on {{date}}', {
            ...AS_IS,
            option: option.name,
            date: formatCalendarDate(start, calendar),
        })
    }
    const end = option.endDate && storedDay(option.endDate)
    if (eventDate && end && eventDate > end) {
        return i18n.t('{{option}} ended on {{date}}', {
            ...AS_IS,
            option: option.name,
            date: formatCalendarDate(end, calendar),
        })
    }
    return undefined
}

/** The options of a category not offered here. */
export const unavailableOptions = (category: Category, scope: OptionScope) =>
    new Set(
        category.options
            .filter((option) => optionProblem(option, scope) !== undefined)
            .map(({ id }) => id)
    )

/** Why the chosen option of a category does not apply; nothing when none is chosen or it applies. */
export const choiceProblem = (
    category: Category,
    chosen: string | undefined,
    scope: OptionScope
) => {
    const option = category.options.find(({ id }) => id === chosen)
    return option && optionProblem(option, scope)
}

/** Category id → the option the event holds, from its comma-separated category options. */
export const heldChoices = (
    held: HeldEvent | undefined,
    categories: readonly Category[]
) => {
    const options = new Set(held?.attributeCategoryOptions?.split(','))
    return Object.fromEntries(
        categories.flatMap(({ id, options: offered }) => {
            const option = offered.find((each) => options.has(each.id))
            return option === undefined ? [] : [[id, option.id]]
        })
    ) satisfies Values
}

/** Whether a category's options need the org unit's ancestors to be known. */
export const limitedByOrgUnit = (categories: readonly Category[]) =>
    categories.some(({ options }) =>
        options.some(({ orgUnitIds }) => orgUnitIds.length > 0)
    )

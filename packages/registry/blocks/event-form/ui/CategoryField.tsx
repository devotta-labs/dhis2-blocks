import i18n from '@dhis2/d2-i18n'
import { memo, useMemo } from 'react'
import { ValueInput } from '@/components/dhis2-value-input'
import type { ValueInputProps } from '@/components/dhis2-value-input'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { EventFormValue } from '../hooks/useEventForm'
import { choiceProblem, unavailableOptions } from '../lib/categories'
import type { Category } from '../lib/metadata'

type Message = NonNullable<ValueInputProps['messages']>[number]

interface CategoryFieldProps {
    category: Category
    /** The control's id: `${formId}-${categoryId}`. */
    id: string
    value?: string
    eventDate?: string
    orgUnits: ReadonlySet<string>
    settings: ValueSettings
    /** The last attempt failed, so an empty choice says it is required. */
    failed: boolean
    serverErrors?: readonly string[]
    readOnly?: string
    readOnlyReason: ValueInputProps['readOnlyReason']
    commit: EventFormValue['commit']
}

/**
 * One category of the program's combination: a required choice of the options that apply to the form's org unit and
 * event date and that the user may enter data for. A chosen option that no longer applies stays shown, with why.
 */
export const CategoryField = memo(
    ({
        category,
        id,
        value,
        eventDate,
        orgUnits,
        settings,
        failed,
        serverErrors,
        readOnly,
        readOnlyReason,
        commit,
    }: CategoryFieldProps) => {
        const scope = { orgUnits, eventDate, calendar: settings.calendar }
        const hidden = useMemo(
            () => unavailableOptions(category, scope),
            [category, orgUnits, eventDate, settings.calendar]
        )
        const problem = choiceProblem(category, value, scope)
        const messages: Message[] = []
        if (problem !== undefined) {
            messages.push({ tone: 'error', text: problem })
        }
        if (failed && value === undefined) {
            messages.push({ tone: 'error', text: i18n.t('Required') })
        }
        for (const text of serverErrors ?? []) {
            messages.push({ tone: 'error', text })
        }
        return (
            <ValueInput
                id={id}
                field={category.field}
                settings={settings}
                label={category.name}
                value={value}
                onChange={commit(category.id)}
                required
                readOnly={readOnly}
                readOnlyReason={readOnlyReason}
                hiddenOptions={hidden}
                messages={messages}
            />
        )
    }
)

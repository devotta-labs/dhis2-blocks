import i18n from '@dhis2/d2-i18n'
import { Alert, AlertTitle } from '@/components/dhis2/ui/alert'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/dhis2/ui/field'
import { ValueInput } from '@/components/dhis2-value-input'
import type { Field } from '@/components/dhis2-value-types'
import { pointValue } from '../lib/location'
import { EVENT_DATE, LOCATION } from '../lib/validate'
import { CategoryField } from './CategoryField'
import { failedAttempt, useEventFormContext } from './context'
import { FormField, fieldModel } from './FormField'
import { HiddenByRules } from './HiddenByRules'
import { AreaField, LocationField } from './LocationField'

const DATE: Field = { valueType: 'DATE' }

// Section names are text, not HTML.
const AS_IS = { interpolation: { escapeValue: false } }

const hiddenTitle = (count: number) =>
    // Both keys are extractable; count also reaches i18next's plural rules.
    count === 1
        ? i18n.t('{{count}} question hidden by rules', { count })
        : i18n.t('{{count}} questions hidden by rules', { count })

/**
 * The form's status, its event date, a choice per category of a non-default combination, the location of a point
 * stage (or a stored area), then each section with a field shown, in metadata order.
 */
export const EventFormFields = () => {
    const value = useEventFormContext()
    const {
        form,
        formId,
        settings,
        state,
        rules,
        blames,
        readOnly,
        locked,
        commit,
        orgUnits,
        orgUnit,
        held,
        locationWarnKm,
    } = value
    const hidden = rules.outcome?.hidden
    const failed = failedAttempt(state) !== undefined
    // Locked only while it saves, a field looks as it did, so nothing moves; its control still says why.
    const lockReason = readOnly === undefined ? 'held' : 'visible'
    return (
        <>
            {readOnly === undefined ? null : (
                <Alert
                    variant={
                        rules.status === 'error' ? 'destructive' : 'default'
                    }
                >
                    <AlertTitle>{readOnly}</AlertTitle>
                </Alert>
            )}
            <ValueInput
                id={`${formId}-${EVENT_DATE}`}
                field={DATE}
                settings={settings}
                label={form.eventDateLabel}
                value={state.eventDate}
                onChange={commit(EVENT_DATE)}
                required
                readOnly={locked}
                readOnlyReason={lockReason}
                messages={
                    failed && !state.eventDate
                        ? [{ tone: 'error', text: i18n.t('Required') }]
                        : undefined
                }
            />
            {form.categories.map((category) => (
                <CategoryField
                    key={category.id}
                    category={category}
                    id={`${formId}-${category.id}`}
                    value={state.categories[category.id]}
                    eventDate={state.eventDate}
                    orgUnits={orgUnits}
                    settings={settings}
                    failed={failed}
                    serverErrors={state.serverErrors.get(category.id)}
                    readOnly={locked}
                    readOnlyReason={lockReason}
                    commit={commit}
                />
            ))}
            {form.location === 'point' ? (
                <LocationField
                    id={`${formId}-${LOCATION}`}
                    value={state.location}
                    orgUnit={orgUnit}
                    settings={settings}
                    serverErrors={state.serverErrors.get(LOCATION)}
                    readOnly={locked}
                    readOnlyReason={lockReason}
                    commit={commit}
                    warnKm={locationWarnKm}
                />
            ) : null}
            {form.location === 'area' &&
            held?.geometry !== undefined &&
            pointValue(held.geometry) === undefined ? (
                <AreaField
                    id={`${formId}-${LOCATION}`}
                    settings={settings}
                    readOnly={readOnly}
                />
            ) : null}
            {form.sections.map((section) => {
                const shown = section.fieldIds.filter(
                    (fieldId) => !hidden?.has(fieldId)
                )
                const sectionBlames = blames?.get(section.id)
                if (sectionBlames !== undefined && section.name !== undefined) {
                    return (
                        <HiddenByRules
                            key={section.id}
                            formId={formId}
                            title={i18n.t('"{{section}}" hidden by rules', {
                                ...AS_IS,
                                section: section.name,
                            })}
                            hidden={[
                                {
                                    key: section.id,
                                    label: section.name,
                                    blames: sectionBlames,
                                },
                            ]}
                        />
                    )
                }
                const hiddenHere = section.fieldIds.flatMap((fieldId) => {
                    const field = form.fields.get(fieldId)
                    const fieldBlames = hidden?.has(fieldId)
                        ? blames?.get(fieldId)
                        : undefined
                    return field && fieldBlames
                        ? [
                              {
                                  key: fieldId,
                                  label: field.label,
                                  blames: fieldBlames,
                              },
                          ]
                        : []
                })
                if (shown.length === 0 && hiddenHere.length === 0) {
                    return null
                }
                const fields = (
                    <>
                        {shown.map((fieldId) => {
                            const field = form.fields.get(fieldId)
                            return (
                                field && (
                                    <FormField
                                        key={fieldId}
                                        field={field}
                                        model={fieldModel(field, value)}
                                        id={`${formId}-${fieldId}`}
                                        formId={formId}
                                        settings={settings}
                                        commit={commit}
                                    />
                                )
                            )
                        })}
                        {hiddenHere.length === 0 ? null : (
                            <HiddenByRules
                                formId={formId}
                                title={hiddenTitle(hiddenHere.length)}
                                hidden={hiddenHere}
                            />
                        )}
                    </>
                )
                if (section.name === undefined) {
                    return <FieldGroup key={section.id}>{fields}</FieldGroup>
                }
                return (
                    <FieldSet key={section.id}>
                        <FieldLegend>{section.name}</FieldLegend>
                        <FieldGroup>{fields}</FieldGroup>
                    </FieldSet>
                )
            })}
        </>
    )
}

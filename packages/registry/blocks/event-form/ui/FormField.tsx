import i18n from '@dhis2/d2-i18n'
import { memo } from 'react'
import { ValueInput } from '@/components/dhis2-value-input'
import type { ValueInputProps } from '@/components/dhis2-value-input'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { Blame } from '@/components/program-rules'
import type { EventFormValue } from '../hooks/useEventForm'
import { blameLine, markerOf } from '../lib/explain'
import type { FormField as StageField } from '../lib/metadata'
import { futureProblem } from '../lib/validate'
import { failedAttempt } from './context'
import { Why } from './Why'

type Message = NonNullable<ValueInputProps['messages']>[number]

// Rule texts are shown as written, not HTML-escaped.
const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

const FILE_TYPES = new Set(['FILE_RESOURCE', 'IMAGE'])

/** Everything one field shows, so a field renders only when its own part of the form changes. */
interface FieldModel {
    value?: string
    required: boolean
    readOnly?: string
    /** Where the reason shows: only in the control's description for a set field's marker, which Tab stops on instead, or while the form saves. */
    readOnlyReason: NonNullable<ValueInputProps['readOnlyReason']>
    hiddenOptions?: ReadonlySet<string>
    messages: readonly Message[]
    valueName?: string
    storedFile?: { value: string; url: string }
    /** What the marker beside the label says, opening `blames`; absent when the rules only give the field messages. */
    marker?: string
    blames: readonly Blame[]
}

/** What the rules, the checks and DHIS2 say of one field. */
export const fieldModel = (
    field: StageField,
    {
        baseUrl,
        state,
        rules,
        names,
        blames,
        readOnly,
        locked,
        held,
    }: Pick<
        EventFormValue,
        | 'baseUrl'
        | 'state'
        | 'rules'
        | 'names'
        | 'blames'
        | 'readOnly'
        | 'locked'
        | 'held'
    >
): FieldModel => {
    const { outcome } = rules
    const { id } = field
    const { valueType } = field.field
    const value =
        outcome === undefined ? state.entered[id] : outcome.effective[id]
    const required = outcome?.required.has(id) ?? field.compulsory
    const completing = state.attempt === 'complete'
    const fieldBlames = blames?.get(id) ?? []
    const setBy = fieldBlames.find(({ effect }) => effect === 'assigned')

    const assigned = outcome?.assigned.has(id) ?? false
    const messages: Message[] = []
    // Shown from the start, so an event opened with such a date says so before an attempt.
    const future = assigned ? undefined : futureProblem(field, value)
    if (future !== undefined) {
        messages.push({ tone: 'error', text: future })
    }
    for (const { kind, text } of outcome?.messages.get(id) ?? []) {
        if (kind === 'error' || kind === 'warning') {
            messages.push({ tone: kind, text })
        } else if (completing) {
            messages.push({
                tone: kind === 'errorOnComplete' ? 'error' : 'warning',
                text,
            })
        } else {
            messages.push({
                tone: 'info',
                text: i18n.t('On completing: {{text}}', { ...AS_IS, text }),
            })
        }
    }
    if (failedAttempt(state) !== undefined && required && !value) {
        messages.push({ tone: 'error', text: i18n.t('Required') })
    }
    for (const text of state.serverErrors.get(id) ?? []) {
        messages.push({ tone: 'error', text })
    }

    const opened = state.opened.entered[id]
    const storedFile =
        FILE_TYPES.has(valueType) &&
        held !== undefined &&
        opened !== undefined &&
        value === opened
            ? {
                  value: opened,
                  url: `${baseUrl}/api/tracker/events/${held.event}/dataValues/${id}/${valueType === 'IMAGE' ? 'image' : 'file'}`,
              }
            : undefined

    // A set field's marker says why; a field locked only while the form saves looks as it did, so nothing moves.
    let readOnlyReason: FieldModel['readOnlyReason'] = 'visible'
    let reason = locked
    if (setBy !== undefined) {
        readOnlyReason = 'described'
        reason = blameLine(setBy, field.label)
    } else if (assigned) {
        reason = i18n.t('Set by a program rule')
    } else if (readOnly === undefined) {
        readOnlyReason = 'held'
    }
    return {
        value,
        required,
        readOnly: reason,
        readOnlyReason,
        hiddenOptions: outcome?.hiddenOptions.get(id),
        messages,
        valueName:
            valueType === 'USERNAME' || value === undefined
                ? value
                : names.get(value),
        storedFile,
        marker: markerOf(fieldBlames),
        blames: fieldBlames,
    }
}

const sameSet = (a?: ReadonlySet<string>, b?: ReadonlySet<string>) =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        a.size === b.size &&
        [...a].every((code) => b.has(code)))

// The rules build new sets, messages and blames on every run, so they are compared by content.
const sameModel = (a: FieldModel, b: FieldModel) =>
    a.value === b.value &&
    a.required === b.required &&
    a.readOnly === b.readOnly &&
    a.readOnlyReason === b.readOnlyReason &&
    a.valueName === b.valueName &&
    a.storedFile?.value === b.storedFile?.value &&
    a.storedFile?.url === b.storedFile?.url &&
    a.marker === b.marker &&
    sameSet(a.hiddenOptions, b.hiddenOptions) &&
    JSON.stringify(a.messages) === JSON.stringify(b.messages) &&
    JSON.stringify(a.blames) === JSON.stringify(b.blames)

interface FormFieldProps {
    field: StageField
    model: FieldModel
    /** The control's id: `${formId}-${fieldId}`. */
    id: string
    formId: string
    settings: ValueSettings
    commit: EventFormValue['commit']
}

/** One data element of the stage, through `ValueInput`, with what the rules and the checks say of it. */
export const FormField = memo(
    ({ field, model, id, formId, settings, commit }: FormFieldProps) => (
        <ValueInput
            id={id}
            field={field.field}
            settings={settings}
            label={field.label}
            description={field.description}
            value={model.value}
            onChange={commit(field.id)}
            required={model.required}
            readOnly={model.readOnly}
            readOnlyReason={model.readOnlyReason}
            labelAside={
                model.marker === undefined ? undefined : (
                    <Why
                        label={field.label}
                        blames={model.blames}
                        formId={formId}
                        marker={model.marker}
                    />
                )
            }
            hiddenOptions={model.hiddenOptions}
            messages={model.messages}
            valueName={model.valueName}
            storedFile={model.storedFile}
        />
    ),
    (a, b) =>
        a.field === b.field &&
        a.id === b.id &&
        a.formId === b.formId &&
        a.settings === b.settings &&
        a.commit === b.commit &&
        sameModel(a.model, b.model)
)

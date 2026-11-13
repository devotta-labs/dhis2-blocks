import { useMemo } from 'react'
import { ValueInput, type EditorProblem } from '@/components/dhis2-value-input'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/dhis2/ui/field'
import { GROUPS } from './labData'

interface Props {
    settings: ValueSettings
    /** Each field's stored value, by field id. */
    values: Record<string, string | undefined>
    required: boolean
    readOnly?: string
    messages: ReadonlyArray<{ tone: 'error' | 'warning'; text: string }>
    /** Option codes hidden on every option set. */
    hiddenOptions: string[]
    density: 'regular' | 'compact'
    /** Right to left. */
    rtl: boolean
    /** The names the host knows for stored org unit, user and file ids. */
    names: Record<string, string>
    /** Where each stored file is served, by file resource id. */
    files: Record<string, string>
    onChange: (
        field: string,
        value: string | null,
        problem?: EditorProblem
    ) => void
}

/** One `ValueInput` for every value type, grouped by how it edits. */
export const ValueInputCanvas = ({
    settings,
    values,
    required,
    readOnly,
    messages,
    hiddenOptions,
    density,
    rtl,
    names,
    files,
    onChange,
}: Props) => {
    const hidden = useMemo(() => new Set(hiddenOptions), [hiddenOptions])
    return (
        // The block draws on a white page; the lab's canvas follows the docs' theme.
        <div
            data-density={density}
            dir={rtl ? 'rtl' : 'ltr'}
            className="flex w-full min-w-0 flex-col gap-8 rounded-lg bg-dhis2-background p-4 md:p-6"
        >
            {GROUPS.map(({ legend, fields }) => (
                <FieldSet key={legend}>
                    <FieldLegend>{legend}</FieldLegend>
                    <FieldGroup className="grid items-start gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                        {fields.map(({ id, label, field }) => {
                            const value = values[id]
                            const url =
                                value === undefined ? undefined : files[value]
                            return (
                                <ValueInput
                                    key={id}
                                    field={field}
                                    settings={settings}
                                    label={label}
                                    value={value}
                                    onChange={(next, problem) =>
                                        onChange(id, next, problem)
                                    }
                                    required={required}
                                    readOnly={readOnly}
                                    hiddenOptions={
                                        field.options ? hidden : undefined
                                    }
                                    messages={messages}
                                    valueName={
                                        value === undefined
                                            ? undefined
                                            : names[value]
                                    }
                                    storedFile={
                                        value === undefined || url === undefined
                                            ? undefined
                                            : { value, url }
                                    }
                                />
                            )
                        })}
                    </FieldGroup>
                </FieldSet>
            ))}
        </div>
    )
}

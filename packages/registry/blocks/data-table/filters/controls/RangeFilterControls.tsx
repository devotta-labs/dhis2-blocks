import i18n from '@dhis2/d2-i18n'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import { useId, type ComponentProps } from 'react'
import type { DateControlProps, NumberControlProps } from './drafts'

const LabelledInput = ({
    label,
    ...props
}: ComponentProps<typeof Input> & { label: string }) => {
    const id = useId()
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor={id} className="font-medium">
                {label}
            </Label>
            <Input id={id} {...props} />
        </div>
    )
}

export const NumberFilterControl = ({
    filter,
    draft,
    onDraftChange,
}: NumberControlProps) => (
    <div className="flex gap-2">
        <LabelledInput
            label={i18n.t('Minimum')}
            type="number"
            min={filter.min}
            max={filter.max}
            step={filter.step}
            value={draft.min}
            onChange={(event) =>
                onDraftChange({ ...draft, min: event.currentTarget.value })
            }
        />
        <LabelledInput
            label={i18n.t('Maximum')}
            type="number"
            min={filter.min}
            max={filter.max}
            step={filter.step}
            value={draft.max}
            onChange={(event) =>
                onDraftChange({ ...draft, max: event.currentTarget.value })
            }
        />
    </div>
)

export const DateFilterControl = ({
    draft,
    onDraftChange,
}: DateControlProps) => (
    <div className="flex gap-2">
        <LabelledInput
            label={i18n.t('From')}
            type="date"
            value={draft.from}
            onChange={(event) =>
                onDraftChange({ ...draft, from: event.currentTarget.value })
            }
        />
        <LabelledInput
            label={i18n.t('To')}
            type="date"
            value={draft.to}
            onChange={(event) =>
                onDraftChange({ ...draft, to: event.currentTarget.value })
            }
        />
    </div>
)

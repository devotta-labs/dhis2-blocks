import i18n from '@dhis2/d2-i18n'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { useId } from 'react'
import type { DataTableTextOperator } from '../types'
import {
    isPresenceOperator,
    textOperators,
    type TextControlProps,
} from './drafts'

const operatorLabel = (operator: DataTableTextOperator): string => {
    switch (operator) {
        case 'contains':
            return i18n.t('Contains')
        case 'equals':
            return i18n.t('Is exactly')
        case 'startsWith':
            return i18n.t('Starts with')
        case 'empty':
            return i18n.t('Is empty')
        case 'notEmpty':
            return i18n.t('Is not empty')
    }
}

export const TextFilterControl = ({
    filter,
    draft,
    onDraftChange,
}: TextControlProps) => {
    const matchId = useId()
    const valueId = useId()
    const operators = textOperators(filter)
    const items = operators.map((operator) => ({
        value: operator,
        label: operatorLabel(operator),
    }))
    return (
        <>
            {operators.length > 1 && (
                <Field className="gap-1">
                    <FieldLabel htmlFor={matchId}>{i18n.t('Match')}</FieldLabel>
                    <Select
                        items={items}
                        value={draft.operator}
                        onValueChange={(next) => {
                            const operator = operators.find(
                                (candidate) => candidate === next
                            )
                            if (operator) onDraftChange({ ...draft, operator })
                        }}
                    >
                        <SelectTrigger id={matchId} size="sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {items.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            )}
            {!isPresenceOperator(draft.operator) && (
                <div className="flex flex-col gap-1">
                    <Label htmlFor={valueId} className="font-medium">
                        {i18n.t('Value')}
                    </Label>
                    <Input
                        id={valueId}
                        value={draft.text}
                        placeholder={filter.placeholder}
                        onChange={(event) =>
                            onDraftChange({
                                ...draft,
                                text: event.currentTarget.value,
                            })
                        }
                    />
                </div>
            )}
        </>
    )
}

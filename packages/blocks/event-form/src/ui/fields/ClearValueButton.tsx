import React from 'react'
import { Button } from '@/registry/dhis2/ui/button'
import { SelectClearIcon } from '@/registry/dhis2/ui/select'
import { useEventFormText } from '../EventFormText'

/** For controls that cannot be emptied by themselves, such as radio buttons and selects. */
export const ClearValueButton = ({
    onClear,
    disabled,
}: {
    onClear(): void
    disabled: boolean
}) => {
    const translate = useEventFormText()
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={translate('Clear')}
            title={translate('Clear')}
            disabled={disabled}
            className="text-dhis2-grey-500 hover:text-dhis2-grey-800"
            onClick={onClear}
        >
            <SelectClearIcon />
        </Button>
    )
}

import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { Button } from '@dhis2/ui'

export interface ClearSelectionsProps {
    onClear: () => void
    disabled?: boolean
}

export const ClearSelections = ({
    onClear,
    disabled = false,
}: ClearSelectionsProps) => (
    <div
        className="flex h-[40px] items-center px-[8px]"
        data-test="clear-selections"
    >
        <Button small secondary disabled={disabled} onClick={onClear}>
            {i18n.t('Clear selections')}
        </Button>
    </div>
)

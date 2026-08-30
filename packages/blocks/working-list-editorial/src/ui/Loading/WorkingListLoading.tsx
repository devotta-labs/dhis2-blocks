import { CircularLoader } from '@dhis2/ui'
import React from 'react'

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

interface WorkingListLoadingProps {
    label: string
    testId: string
}

export const WorkingListLoading = ({
    label,
    testId,
}: WorkingListLoadingProps) => {
    return (
        <div
            className="flex min-h-[600px] items-center justify-center text-[var(--colors-grey700)]"
            data-testid={testId}
            role="status"
            aria-live="polite"
        >
            <CircularLoader small />
            <span className={visuallyHiddenClassName}>{label}</span>
        </div>
    )
}

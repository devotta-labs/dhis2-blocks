import React, { useId } from 'react'
import { Input } from '@/components/dhis2/ui/input'
import { FieldFrame } from './FieldFrame'

/** A disabled stand-in while program metadata loads or after it failed. */
export const PendingInput = ({
    label,
    className,
}: {
    label: string
    className?: string
}) => {
    const id = useId()
    return (
        <FieldFrame controlId={id} label={label} className={className}>
            <Input id={id} type="text" disabled />
        </FieldFrame>
    )
}

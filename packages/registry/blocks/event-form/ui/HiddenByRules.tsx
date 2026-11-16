import { useId, useState } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { blameLine } from '../lib/explain'
import type { Blame } from '@/components/program-rules'
import { Why } from './Why'

interface Hidden {
    key: string
    label: string
    blames: readonly Blame[]
}

/** A list of what the rules hid, closed until pressed, each line saying which rule and why, with its own `Why?`. */
export const HiddenByRules = ({
    title,
    hidden,
    formId,
}: {
    title: string
    hidden: readonly Hidden[]
    formId: string
}) => {
    const [open, setOpen] = useState(false)
    const listId = useId()
    return (
        <div className="flex flex-col items-start gap-1">
            <Button
                variant="ghost"
                size="sm"
                className="h-auto min-h-7 text-start whitespace-normal"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen(!open)}
            >
                {title}
            </Button>
            <ul
                id={listId}
                hidden={!open}
                className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-dhis2-muted-foreground"
            >
                {hidden.map(({ key, label, blames }) => {
                    const [first] = blames
                    return (
                        first && (
                            <li key={key}>
                                {blameLine(first, label)}{' '}
                                <Why
                                    label={label}
                                    blames={blames}
                                    formId={formId}
                                />
                            </li>
                        )
                    )
                })}
            </ul>
        </div>
    )
}

import i18n from '@dhis2/d2-i18n'
import { IconWarningFilled16 } from '@dhis2/ui-icons'
import React from 'react'
import { z } from 'zod'
import type { WorkingListDisplayRow } from '../../provider/contracts'
import type { WorkingListCellValue } from '../../query/normalizeRows'
import type { CellDisplayValue } from '../../registry/valueTypes'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'

/**
 * Best-effort rendering for a value that failed validation: the raw scalar
 * verbatim, an empty cell for a missing value, a dash when unrenderable.
 */
const InvalidCellScalarSchema = z.union([z.string(), z.number(), z.boolean()])

export const invalidCellText = (
    cellValue: Extract<WorkingListCellValue, { valid: false }>
) => {
    const raw = cellValue.raw
    if (raw === undefined || raw === null || raw === '') {
        return ''
    }
    const scalar = InvalidCellScalarSchema.safeParse(raw)
    return scalar.success ? String(scalar.data) : '-'
}

export const RowIssuesMarker = ({ row }: { row: WorkingListDisplayRow }) => {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <span
                        className="inline-flex items-center text-dhis2-destructive"
                        role="img"
                        data-testid={`row-issues-${row.id}`}
                        aria-label={i18n.t(
                            'Row has {{count}} data quality issues',
                            {
                                count: row.issues.length,
                            }
                        )}
                    />
                }
            >
                <IconWarningFilled16 />
            </TooltipTrigger>
            <TooltipContent>
                <ul className="m-0 pl-4">
                    {row.issues.map((issue) => (
                        <li key={`${issue.fieldId}-${issue.message}`}>
                            {`${issue.fieldName}: ${issue.message}`}
                        </li>
                    ))}
                </ul>
            </TooltipContent>
        </Tooltip>
    )
}

export const CellValue = ({ display }: { display: CellDisplayValue }) => {
    switch (display.kind) {
        case 'empty':
            return null
        case 'link':
            return (
                <a
                    className="text-dhis2-primary underline-offset-2"
                    href={display.href}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    {display.text}
                </a>
            )
        case 'file':
            return (
                <a
                    className="text-dhis2-primary underline-offset-2"
                    href={display.href}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    {display.text}
                </a>
            )
        case 'image':
            return (
                <a
                    className="text-dhis2-primary underline-offset-2"
                    href={display.href}
                    rel="noreferrer noopener"
                    target="_blank"
                >
                    <img
                        alt={display.alt || i18n.t('Image attachment')}
                        className="block h-10 w-14 rounded-[3px] border border-dhis2-border-strong bg-dhis2-accent object-cover"
                        loading="lazy"
                        src={display.previewHref}
                    />
                </a>
            )
        case 'coordinate':
            return (
                <span
                    title={i18n.t(
                        'Latitude {{latitude}}, longitude {{longitude}}',
                        {
                            latitude: display.latitude,
                            longitude: display.longitude,
                        }
                    )}
                >
                    {display.text}
                </span>
            )
        case 'reference':
        case 'text':
            return <>{display.text}</>
    }
}

import React from 'react'
import { VisitService, VisitServices, VisitStatus } from '..'
import type { VisitStatusVariant } from '..'

export const VARIANTS = [
    ['completed', 'success'],
    ['in-progress', 'info'],
    ['scheduled', 'neutral'],
    ['overdue', 'destructive'],
    ['skipped', 'neutral'],
] as const satisfies readonly (readonly [VisitStatusVariant, string])[]

export const Statuses = () => (
    <>
        {VARIANTS.map(([variant]) => (
            <VisitStatus
                key={variant}
                variant={variant}
                data-testid={variant}
            />
        ))}
        <VisitServices>
            {VARIANTS.map(([variant]) => (
                <VisitService
                    key={variant}
                    status={variant}
                    data-testid={`service-${variant}`}
                >
                    Vaccination
                </VisitService>
            ))}
        </VisitServices>
        <span data-testid="canvas" className="bg-[Canvas]" />
    </>
)

export const partOf = (element: Element, slot: string) => {
    const part = element.querySelector(`[data-slot="${slot}"]`)
    if (part === null) {
        throw new Error(`No ${slot} in ${element.outerHTML}`)
    }
    return part
}

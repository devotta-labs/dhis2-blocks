import type { ReactNode } from 'react'

/**
 * A 16 px icon drawn at the 1 px weight of `@dhis2/ui-icons`, for the two that set has no match for. Buttons fill
 * their icons, so the lines sit in a group that is never filled.
 */
const Icon = ({ lines, solid }: { lines: ReactNode; solid?: ReactNode }) => (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {lines}
        </g>
        {solid}
    </svg>
)

/** The device's position: a fix, as maps show it. */
export const LocateIcon = () => (
    <Icon
        lines={
            <>
                <circle cx="8" cy="8" r="4.5" />
                <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" />
            </>
        }
        solid={<circle cx="8" cy="8" r="1.75" fill="currentColor" />}
    />
)

/** A folded map. */
export const MapIcon = () => (
    <Icon
        lines={
            <>
                <path d="M1.5 3.5 5.5 2l5 2 4-1.5v10l-4 1.5-5-2-4 1.5z" />
                <path d="M5.5 2v10M10.5 4v10" />
            </>
        }
    />
)

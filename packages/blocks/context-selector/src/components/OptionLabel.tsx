import React from 'react'
import type { OptionIcon } from '../types'

interface OptionLabelProps {
    icon?: OptionIcon
    label: string
}

const OptionIconView = ({ source, color, alternativeText }: OptionIcon) => (
    <div
        className="h-[22px] w-[22px] shrink-0 overflow-hidden rounded-[2px]"
        style={{ backgroundColor: color }}
        title={alternativeText}
        aria-hidden="true"
    >
        {source ? (
            <img className="block h-full w-full" src={source} alt="" />
        ) : null}
    </div>
)

/** Capture's 22px program/stage icon followed by a 5px label gap. */
export const OptionLabel = ({ icon, label }: OptionLabelProps) => (
    <span className="flex items-center">
        {icon ? (
            <span className="flex items-center pe-[5px]" aria-hidden="true">
                <OptionIconView {...icon} />
            </span>
        ) : null}
        <span>{label}</span>
    </span>
)

'use client'

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { cva } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'

/**
 * The @dhis2/ui checkbox box: a 1px grey800 ring that turns teal when
 * checked. State comes from `data-checked` / `data-disabled`, so any element
 * can wear it, e.g. the non-interactive box in a multi-select option.
 */
const checkboxBoxVariants = cva(
    'flex shrink-0 items-center justify-center border border-dhis2-grey-800 bg-white text-white data-checked:border-dhis2-teal-900 data-checked:bg-dhis2-teal-500 [&_svg]:fill-current',
    {
        variants: {
            size: {
                regular:
                    'size-[18px] rounded-[3px] data-disabled:border-dhis2-grey-400 data-disabled:bg-dhis2-grey-300 data-disabled:data-checked:border-dhis2-grey-400 data-disabled:data-checked:bg-dhis2-grey-300',
                dense: 'size-[14px] rounded-[2px] data-disabled:border-dhis2-grey-400 data-disabled:bg-dhis2-grey-400 data-disabled:data-checked:border-dhis2-grey-500 data-disabled:data-checked:bg-dhis2-grey-400',
            },
        },
        defaultVariants: { size: 'regular' },
    }
)

/*
 * The @dhis2/ui checkbox checkmarks, which are heavier than IconCheckmark16.
 * Their viewBoxes are cropped by the 1px ring so the mark sits inside the
 * box's CSS border exactly where it does in the original 18/14px SVG.
 */
const checkmarks = {
    regular: {
        size: 16,
        viewBox: '1 1 16 16',
        d: 'M4.74451387,8.02852516 C4.39595738,8.11985643 4.12375034,8.39235188 4.03251575,8.74127768 C3.94128115,9.09020348 4.04521722,9.46125864 4.30437605,9.71182782 L7.29823844,12.7078028 C7.68753993,13.0973991 8.31859767,13.0973991 8.70789916,12.7078028 L13.695624,6.71585285 C13.9547828,6.46528367 14.0587189,6.09422851 13.9674843,5.74530271 C13.8762497,5.39637691 13.6040426,5.12388146 13.2554861,5.0325502 C12.9069296,4.94121893 12.5362672,5.04526513 12.2859632,5.30469855 L8.0030688,10.5910713 L5.71403676,8.30067351 C5.46373279,8.0412401 5.09307036,7.9371939 4.74451387,8.02852516 Z',
    },
    dense: {
        size: 12,
        viewBox: '1 1 12 12',
        d: 'M10.3520005,3.30015877 L5.54268293,8.03252726 L3.64634146,6.16652726 L2.28668615,7.5044281 L5.54310367,10.7010587 L11.7145993,4.628307 L10.3520005,3.30015877 Z',
    },
}

function CheckboxCheckmark({
    size = 'regular',
}: {
    size?: 'regular' | 'dense'
}) {
    const { size: px, viewBox, d } = checkmarks[size]
    return (
        <svg
            width={px}
            height={px}
            viewBox={viewBox}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="block fill-current"
        >
            <path d={d} />
        </svg>
    )
}

/** shadcn Checkbox (Base UI) restyled to match @dhis2/ui Checkbox. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                checkboxBoxVariants(),
                'peer relative cursor-pointer outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-dhis2-ring data-disabled:cursor-not-allowed aria-invalid:border-dhis2-red-500',
                className
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="grid place-content-center text-current transition-none"
            >
                <CheckboxCheckmark />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    )
}

export { Checkbox, CheckboxCheckmark, checkboxBoxVariants }

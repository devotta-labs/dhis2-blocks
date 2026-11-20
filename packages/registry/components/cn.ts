import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            radius: ['dhis2-sm', 'dhis2-md', 'dhis2-lg'],
            shadow: ['dhis2-popover', 'dhis2-card'],
        },
    },
})

/** Merges Tailwind classes, including DHIS2 radius and shadow tokens, so later classes in each group win. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

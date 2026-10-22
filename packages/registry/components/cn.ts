import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge only knows Tailwind's own radius and shadow scales; teach it
// the DHIS2 tokens from theme.css so a caller's rounded-*/shadow-* still wins.
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            radius: ['dhis2-sm', 'dhis2-md', 'dhis2-lg'],
            shadow: ['dhis2-popover', 'dhis2-card'],
        },
    },
})

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/**
 * A row of pairs with a hairline between them. Each child draws its divider
 * half a gap before itself; the row clips the one that starts each line, with
 * a little room left for focus rings.
 */
export const DIVIDED =
    'gap-x-5 -ms-1.5 ps-1.5 overflow-x-clip [&>:not(.sr-only)]:relative [&>:not(.sr-only)]:before:absolute [&>:not(.sr-only)]:before:inset-y-0.5 [&>:not(.sr-only)]:before:-start-2.5 [&>:not(.sr-only)]:before:w-px [&>:not(.sr-only)]:before:bg-dhis2-border'

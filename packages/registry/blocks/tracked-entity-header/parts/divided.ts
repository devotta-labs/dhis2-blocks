/**
 * A row of pairs with a hairline between them. Each child draws its divider
 * half a gap before itself; the row clips the one that starts each line, with
 * a little room left for focus rings. A child laid out as `contents` has
 * no box of its own, so no divider.
 */
export const DIVIDED =
    'gap-x-5 -ms-1.5 ps-1.5 overflow-x-clip [&>:not(.sr-only,.contents)]:relative [&>:not(.sr-only,.contents)]:before:absolute [&>:not(.sr-only,.contents)]:before:inset-y-0.5 [&>:not(.sr-only,.contents)]:before:-start-2.5 [&>:not(.sr-only,.contents)]:before:w-px [&>:not(.sr-only,.contents)]:before:bg-dhis2-border'

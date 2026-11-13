/**
 * Points the density tokens at one density's values for everything inside the
 * element. The values themselves live in theme.css.
 */
export const DENSITY = {
    compact:
        '[--dhis2-control-h:var(--dhis2-compact-control-h)] [--dhis2-control-h-sm:var(--dhis2-compact-control-h-sm)] [--dhis2-row-h:var(--dhis2-compact-row-h)] [--dhis2-pane-pad:var(--dhis2-compact-pane-pad)] [--dhis2-gap:var(--dhis2-compact-gap)] [--dhis2-text:var(--dhis2-compact-text)] [--dhis2-text-sm:var(--dhis2-compact-text-sm)] [--dhis2-text-xs:var(--dhis2-compact-text-xs)]',
    comfortable:
        '[--dhis2-control-h:var(--dhis2-comfortable-control-h)] [--dhis2-control-h-sm:var(--dhis2-comfortable-control-h-sm)] [--dhis2-row-h:var(--dhis2-comfortable-row-h)] [--dhis2-pane-pad:var(--dhis2-comfortable-pane-pad)] [--dhis2-gap:var(--dhis2-comfortable-gap)] [--dhis2-text:var(--dhis2-comfortable-text)] [--dhis2-text-sm:var(--dhis2-comfortable-text-sm)] [--dhis2-text-xs:var(--dhis2-comfortable-text-xs)]',
}

export type Density = keyof typeof DENSITY

/** The height of a pane's header and of a toolbar: a control and its breathing room. */
export const BAR_HEIGHT =
    'min-h-[calc(var(--dhis2-control-h)+var(--dhis2-pane-pad))]'

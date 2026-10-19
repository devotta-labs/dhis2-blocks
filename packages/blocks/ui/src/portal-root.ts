/**
 * @dhis2/ui popups (Modal, Select, CalendarInput, …) portal into this node with
 * `z-index: auto` and stack by DOM order. Popovers and dialogs render here,
 * also without a z-index, so a DHIS2 popup opened from inside one paints above
 * it, exactly as it did inside a @dhis2/ui Popover or Modal.
 */
export const dhis2PortalRoot = () =>
    document.getElementById('dhis2-portal-root') ?? undefined

import React, { Component, type ReactNode } from 'react'

/**
 * `CalendarInput` can throw while rendering (its Ethiopian calendar fails to resolve eras in some
 * browsers). One date field must not take the whole form down, so a failure swaps in the
 * fallback for as long as the field is mounted.
 */
export class CalendarInputBoundary extends Component<
    { fallback: ReactNode; children: ReactNode },
    { failed: boolean }
> {
    override state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    override render() {
        return this.state.failed ? this.props.fallback : this.props.children
    }
}

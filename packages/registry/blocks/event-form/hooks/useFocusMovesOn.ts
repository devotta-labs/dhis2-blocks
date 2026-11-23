import { useLayoutEffect, useRef } from 'react'
import type { FocusEvent } from 'react'

const neighbours = (target: Element, controlIds: readonly string[]) => {
    const after: string[] = []
    const before: string[] = []
    for (const id of controlIds) {
        const control = document.getElementById(id)
        if (control === null) {
            continue
        }
        const following =
            target.compareDocumentPosition(control) &
            Node.DOCUMENT_POSITION_FOLLOWING
        if (following && !control.contains(target)) {
            after.push(id)
        } else {
            before.unshift(id)
        }
    }
    return [...after, ...before]
}

/**
 * When a commit removes the focused element, focus goes on to the next field still on the page, or else the one before. `controlIds`
 * are the form's field controls in page order.
 */
export const useFocusMovesOn = (controlIds: readonly string[]) => {
    const formRef = useRef<HTMLFormElement>(null)
    const anchor = useRef<Element | null>(null)
    const around = useRef<string[]>([])
    const ids = useRef(controlIds)
    ids.current = controlIds

    useLayoutEffect(() => {
        const held = anchor.current
        const active = document.activeElement
        if (
            held === null ||
            held.isConnected ||
            (active !== null && active !== document.body)
        ) {
            return
        }
        for (const id of around.current) {
            const element = document.getElementById(id)
            if (element !== null) {
                element.focus()
                return
            }
        }
    })

    const inForm = (element: EventTarget | null) =>
        element instanceof Element &&
        formRef.current?.contains(element) === true
            ? element
            : null
    const track = (element: EventTarget | null) => {
        anchor.current = inForm(element)
        if (anchor.current !== null) {
            around.current = neighbours(anchor.current, ids.current)
        }
    }

    return {
        ref: formRef,
        onFocus: (event: FocusEvent) => track(event.target),
        onBlur: (event: FocusEvent) => track(event.relatedTarget),
    }
}

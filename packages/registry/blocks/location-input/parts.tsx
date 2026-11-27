import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, type ReactNode } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { cn } from '@/components/dhis2/ui/cn'
import { FieldDescription, FieldLabel } from '@/components/dhis2/ui/field'
import { IconWarningFilled16 } from '@dhis2/ui-icons'
import type { Note } from './notes'
import type { LocationInputProps } from './types'

type Message = NonNullable<LocationInputProps['messages']>[number]

/** A button inside the field: an icon, named, larger on touch. */
export const FIELD_BUTTON =
    'size-8 text-dhis2-subtle-foreground hover:text-dhis2-foreground pointer-coarse:size-10'

/** A press that keeps focus where it is, so half-typed text is not committed. */
export const keepFocus = (event: { preventDefault: () => void }) =>
    event.preventDefault()

/** The field's label, marked when required, with the host's `labelAside` on its row. */
export const LabelRow = ({
    label,
    required,
    aside,
}: {
    label: string
    required?: boolean
    aside?: ReactNode
}) => {
    const title = (
        <FieldLabel>
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
        </FieldLabel>
    )
    return aside === undefined ? (
        title
    ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {title}
            {aside}
        </div>
    )
}

/**
 * How the field is drawn while it cannot be changed, from `readOnly` and `readOnlyReason`: `drawn` keeps its buttons,
 * inert while `held`; `hidden` puts the reason only in the box's description; `skipped` takes the box out of Tab.
 */
export const lockOf = (
    readOnly: string | undefined,
    reason: LocationInputProps['readOnlyReason'] = 'visible'
) => {
    const held = readOnly !== undefined && reason === 'held'
    return {
        held,
        drawn: readOnly === undefined || held,
        hidden: readOnly !== undefined && reason !== 'visible',
        skipped: readOnly !== undefined && reason === 'described',
    }
}

/** The reason the field cannot be changed, under it or only read out with the box. */
export const ReadOnlyReason = ({
    readOnly,
    hidden,
}: {
    readOnly?: string
    hidden: boolean
}) =>
    readOnly === undefined ? null : (
        <FieldDescription className={hidden ? 'sr-only' : undefined}>
            {readOnly}
        </FieldDescription>
    )

/** The quiet line under the field: muted, or a warning marked by its icon and colour together. */
export const Notes = ({ notes }: { notes: readonly Note[] }) => {
    if (notes.length === 0) return null
    const warning = notes.some(({ tone }) => tone === 'warning')
    return (
        <FieldDescription
            className={
                warning
                    ? 'flex items-start gap-1.5 text-dhis2-warning-strong'
                    : 'tabular-nums'
            }
        >
            {warning ? (
                <span className="mt-0.5 shrink-0">
                    <IconWarningFilled16 />
                </span>
            ) : null}
            <span>{notes.map(({ text }) => text).join(' · ')}</span>
        </FieldDescription>
    )
}

// Messages are shown as the host gives them, not HTML-escaped.
const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

// A warning or an error is marked by its word, so it never rests on colour alone, as a value input marks its own.
const TONES = {
    error: {
        border: 'border-dhis2-destructive-indicator',
        colour: 'text-dhis2-destructive-indicator',
        word: () => i18n.t('Error:', AS_IS),
        say: (message: string) =>
            i18n.t('Error: {{message}}', { ...AS_IS, message }),
    },
    warning: {
        border: 'border-dhis2-warning-indicator',
        colour: 'text-dhis2-warning-indicator',
        word: () => i18n.t('Warning:', AS_IS),
        say: (message: string) =>
            i18n.t('Warning: {{message}}', { ...AS_IS, message }),
    },
}
const SAID: ReadonlyArray<'error' | 'warning'> = ['error', 'warning']

/**
 * A host's error or warning that appears once the field is on the page is said, an error at once; those it opens with
 * are read with the field. Information is not said: a host may update it on every change.
 */
const useSaid = (messages: readonly Message[]) => {
    const latest = useRef(messages)
    latest.current = messages
    const said = useRef<ReadonlySet<string>>()
    // Written out, so the effect runs when what is said changes, not for each array a host builds.
    const key = JSON.stringify(messages)
    useEffect(() => {
        const keyOf = ({ tone, text }: Message) => `${tone}\n${text}`
        const now = latest.current.filter(({ tone }) => tone !== 'info')
        const before = said.current
        said.current = new Set(now.map(keyOf))
        if (before === undefined) return
        const fresh = now.filter((message) => !before.has(keyOf(message)))
        for (const tone of SAID) {
            const texts = fresh
                .filter((message) => message.tone === tone)
                .map(({ text }) => TONES[tone].say(text))
            if (texts.length > 0) {
                announce(
                    texts.join(' '),
                    tone === 'error' ? 'assertive' : 'polite'
                )
            }
        }
    }, [key])
}

/** The host's messages under the field: information as it is, a warning or an error after its word. */
export const Messages = ({ messages }: { messages: readonly Message[] }) => {
    useSaid(messages)
    return messages.map(({ tone, text }, index) => (
        <FieldDescription
            // oxlint-disable-next-line react/no-array-index-key -- messages have no ids, and two can say the same
            key={index}
            className={cn(
                'border-s-2 ps-1.5',
                tone === 'info'
                    ? 'border-dhis2-neutral-indicator'
                    : TONES[tone].border
            )}
        >
            {tone === 'info' ? (
                text
            ) : (
                <span>
                    <span className={cn('font-medium', TONES[tone].colour)}>
                        {TONES[tone].word()}
                    </span>{' '}
                    {text}
                </span>
            )}
        </FieldDescription>
    ))
}

/** A panel's footer: what is recorded in words on the left, actions on the right. */
export const PanelFooter = ({
    summary,
    children,
}: {
    summary: string
    children: ReactNode
}) => (
    <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
        <p className="m-0 min-w-0 flex-1 truncate text-xs text-dhis2-muted-foreground tabular-nums">
            {summary}
        </p>
        <div className="flex items-center gap-1.5 max-sm:w-full max-sm:justify-end">
            {children}
        </div>
    </div>
)

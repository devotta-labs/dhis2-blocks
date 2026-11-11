import i18n from '@dhis2/d2-i18n'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import type { ValueMeta } from '@/components/dhis2-value-display'
import { cellKind, textDirectionFor } from '@/components/dhis2-value-types'
import type {
    CellKind,
    Field,
    ValueSettings,
} from '@/components/dhis2-value-types'
import { announce } from '@/components/dhis2/ui/announcer'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field as FieldRoot,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import { Textarea } from '@/components/dhis2/ui/textarea'
import { DownloadLink } from './editors/FileEditor'
import { editorFor } from './editors/popupEditors'
import type { EditorProblem } from './editors/popupEditors'
import { focusInto } from './focusInto'
import {
    ChoiceInput,
    RADIO_LIMIT,
    asRadios,
    offeredOptions,
    visibleCount,
} from './kinds/ChoiceInput'
import { DateInput, dateFormatHint } from './kinds/DateInput'
import { EditorInput, useEditorCommits } from './kinds/EditorInput'
import { SearchInput, unknownName } from './kinds/SearchInput'
import { READ_ONLY_CLASS, TypedInput } from './kinds/TypedInput'
import { keyOf, useDraft } from './useDraft'

type Tone = 'error' | 'warning' | 'info'

export interface ValueInputProps {
    /** Another value type, field mask or option set is another field, and replaces what was typed. */
    field: Field
    settings: ValueSettings
    label: string
    description?: string
    /** The value as DHIS2 stores it; `null` is no value, as `undefined` is. */
    value: string | null | undefined
    /** Called when a value is committed (the field is left, Enter, a pick), never per keystroke. */
    onChange(value: string | null, problem?: EditorProblem): void
    required?: boolean
    /** Why the field cannot be edited; absent means it can. */
    readOnly?: string
    /** Option codes a rule hides. */
    hiddenOptions?: ReadonlySet<string>
    /** Rule or host messages, shown under the field. */
    messages?: ReadonlyArray<{ tone: Tone; text: string }>
    /** The name of a stored org unit or file id. */
    valueName?: string
    /**
     * The file or image DHIS2 holds for the field: its file resource id and where it is served. Its link and preview
     * show only while the field holds that id, so the link may stay the same when the file changes.
     */
    storedFile?: { value: string; url: string }
    id?: string
}

/** Why a value type no control edits is read-only, as the data entry grid says it too. */
export const editedElsewhere = () => i18n.t('Edit this field in its own form')

// Messages are shown as the rules and the host give them, not HTML-escaped.
const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

// The tone in words as well as colour.
const TONES = {
    error: {
        border: 'border-dhis2-destructive-indicator',
        say: (message: string) =>
            i18n.t('Error: {{message}}', { ...AS_IS, message }),
    },
    warning: {
        border: 'border-dhis2-warning-indicator',
        say: (message: string) =>
            i18n.t('Warning: {{message}}', { ...AS_IS, message }),
    },
    info: {
        border: 'border-dhis2-neutral-indicator',
        say: (message: string) =>
            i18n.t('Information: {{message}}', { ...AS_IS, message }),
    },
} satisfies Record<Tone, { border: string; say: (message: string) => string }>

interface PartProps {
    /** A pop-up editor's: plain, see `ValueInput`. */
    plain: boolean
    id?: string
    className?: string
    children: ReactNode
}

const Description = ({ plain, className, ...props }: PartProps) =>
    plain ? (
        <p
            className={cn(
                'm-0 text-sm leading-normal text-dhis2-muted-foreground',
                className
            )}
            {...props}
        />
    ) : (
        <FieldDescription className={className} {...props} />
    )

const Problem = ({ plain, ...props }: PartProps) =>
    plain ? (
        <p role="alert" className="text-sm text-dhis2-destructive" {...props} />
    ) : (
        <FieldError {...props} />
    )

// A control as wide as the value it holds; the field is as wide as the host makes it.
const WIDTHS = new Map<CellKind, string>([
    ['number', 'max-w-48'],
    ['time', 'max-w-32'],
    ['date', 'max-w-56'],
    ['dateTime', 'max-w-64'],
])

const metaOf = ({ valueType, options }: Field): ValueMeta => ({
    valueType,
    optionSet: options && {
        options: options.map(({ code, name }) => ({ code, displayName: name })),
    },
})

/** A read-only stored file's "Download", after an image's preview, which leaves when the image does not load. */
const StoredFile = ({
    url,
    image,
    name,
}: {
    url: string
    image: boolean
    name: string
}) => {
    const [unloadable, setUnloadable] = useState<string>()
    return (
        <div className="flex flex-col items-start gap-1">
            {image && url !== unloadable ? (
                <img
                    src={`${url}?dimension=MEDIUM`}
                    alt={name}
                    onError={() => setUnloadable(url)}
                    className="max-h-48 max-w-full rounded-dhis2-sm object-contain"
                />
            ) : null}
            <DownloadLink url={url} />
        </div>
    )
}

/** A form control for any DHIS2 value type: labelled, described, and reporting a value only when it is committed. */
export const ValueInput = ({
    field,
    settings,
    label,
    description,
    value: givenValue,
    onChange,
    required = false,
    readOnly,
    messages = [],
    hiddenOptions,
    valueName,
    storedFile,
    id: givenId,
}: ValueInputProps): ReactNode => {
    // One "no value" for every kind, as `onChange` reports it back (`null`) or a host keeps it (`undefined`).
    const value = givenValue ?? undefined
    // The stored file's link, while the field holds that file: not once it is removed or replaced here.
    const fileUrl = storedFile?.value === value ? storedFile?.url : undefined
    const generatedId = useId()
    const id = givenId ?? generatedId
    const kind = cellKind(field)
    const typed = kind === 'text' || kind === 'number' || kind === 'time'
    const dated = kind === 'date' || kind === 'dateTime'
    const choice =
        kind === 'boolean' || kind === 'trueOnly' || kind === 'option'
    // A pop-up type with no editor registered is shown read-only, as in the data entry grid.
    const popup = kind === 'popup' && editorFor(field.valueType) !== undefined
    const edited = typed || dated || choice || popup || kind === 'search'
    const reason = readOnly ?? (edited ? undefined : editedElsewhere())
    // A long option set's typed text may name only the options offered, so a hidden one is refused as any other text.
    const options = field.options
    const offered = useMemo(
        () =>
            options === undefined || hiddenOptions === undefined
                ? field
                : {
                      ...field,
                      options: offeredOptions(options, hiddenOptions, value),
                  },
        [field, options, hiddenOptions, value]
    )
    const draft = useDraft({
        field: offered,
        settings,
        value,
        onChange,
        readOnly: reason !== undefined,
    })
    // A pop-up editor names and describes its own controls, so its field's parts are plain: in a Field, Base UI would
    // link them a second time. An editor of one control (a text area, a combobox of chips) is a field with a label; one
    // of several (an age, a coordinate, a list of boxes, a file) is a fieldset with a legend.
    const editor = reason === undefined && popup
    const oneControl =
        field.valueType === 'LONG_TEXT' ||
        (field.valueType === 'MULTI_TEXT' &&
            visibleCount(field.options ?? [], hiddenOptions) > RADIO_LIMIT)
    const radios =
        (kind === 'boolean' || kind === 'option') &&
        asRadios(field, hiddenOptions)
    const commits = useEditorCommits(
        value,
        onChange,
        keyOf(field, settings),
        reason !== undefined
    )
    const problem = draft.problem ?? (editor ? commits.problem : undefined)
    const invalid =
        problem !== undefined || messages.some(({ tone }) => tone === 'error')
    const labelId = `${id}-label`
    // A rule's error or warning that appears once the field is on the page is said, an error at once (as the house
    // announcer asks); those it opens with are read with the field. Information is not said: a rule may update it on
    // every commit.
    const sayable = messages
        .filter(({ tone }) => tone !== 'info')
        .map(({ tone, text }) => `${tone}:${TONES[tone].say(text)}`)
        .join('\n')
    const said = useRef(new Set(sayable.split('\n')))
    useEffect(() => {
        const now = sayable.split('\n')
        const fresh = now.filter(
            (each) => each !== '' && !said.current.has(each)
        )
        said.current = new Set(now)
        for (const tone of ['error', 'warning'] as const) {
            const texts = fresh
                .filter((each) => each.startsWith(`${tone}:`))
                .map((each) => each.slice(tone.length + 1))
            if (texts.length > 0) {
                announce(
                    texts.join(' '),
                    tone === 'error' ? 'assertive' : 'polite'
                )
            }
        }
    }, [sayable])
    const describedBy = [
        description === undefined ? '' : `${id}-description`,
        problem === undefined ? '' : `${id}-problem`,
        ...messages.map((_, index) => `${id}-message-${index}`),
    ]
        .filter((each) => each !== '')
        .join(' ')

    const file =
        field.valueType === 'FILE_RESOURCE' || field.valueType === 'IMAGE'
    // Ids whose names the host may know.
    const named = kind === 'search' || file
    // One piece of text, so the mark follows the last word however the label wraps.
    const title = (
        <span>
            {label}
            {required ? (
                <span
                    aria-hidden="true"
                    className="ms-0.5 text-dhis2-destructive"
                >
                    *
                </span>
            ) : null}
            {editor && required ? (
                // An editor's controls cannot say it, so its name does.
                <span className="sr-only"> {i18n.t('required')}</span>
            ) : null}
        </span>
    )
    let control: ReactNode
    if (editor) {
        control = (
            <EditorInput
                labelId={labelId}
                describedBy={describedBy || undefined}
                invalid={invalid}
                field={field}
                settings={settings}
                value={value}
                valueName={valueName}
                fileUrl={fileUrl}
                hiddenOptions={hiddenOptions}
                commits={commits}
            />
        )
    } else if (reason === undefined && kind === 'search') {
        control = (
            <SearchInput
                id={id}
                field={field}
                value={value}
                valueName={valueName}
                required={required}
                onChange={onChange}
            />
        )
    } else if (dated) {
        control = (
            <DateInput
                id={id}
                field={field}
                settings={settings}
                draft={draft}
                readOnly={reason !== undefined}
                required={required}
                className={WIDTHS.get(kind)}
            />
        )
    } else if (typed) {
        control = (
            <TypedInput
                id={id}
                field={field}
                draft={draft}
                readOnly={reason !== undefined}
                required={required}
                className={WIDTHS.get(kind)}
            />
        )
    } else if (choice) {
        control = (
            <ChoiceInput
                id={id}
                legend={title}
                field={field}
                value={value}
                hiddenOptions={hiddenOptions}
                settings={settings}
                draft={draft}
                readOnly={reason !== undefined}
                required={required}
                onChange={onChange}
            />
        )
    } else {
        const shown =
            named && value !== undefined
                ? (valueName ?? unknownName(value))
                : formatDhis2Value(value, metaOf(field), {
                      calendar: settings.calendar,
                  })
        control = (
            <>
                {field.valueType === 'LONG_TEXT' ? (
                    <Textarea
                        id={id}
                        dir="auto"
                        readOnly
                        aria-required={required || undefined}
                        value={shown}
                        className={READ_ONLY_CLASS}
                    />
                ) : (
                    <Input
                        id={id}
                        type="text"
                        readOnly
                        aria-required={required || undefined}
                        value={shown}
                        dir={textDirectionFor(field)}
                        className={cn(READ_ONLY_CLASS, 'rtl:text-right')}
                    />
                )}
                {file && fileUrl !== undefined ? (
                    <StoredFile
                        url={fileUrl}
                        image={field.valueType === 'IMAGE'}
                        name={shown}
                    />
                ) : null}
            </>
        )
    }

    const parts = (
        <>
            {description === undefined ? null : (
                <Description plain={editor} id={`${id}-description`}>
                    {description}
                </Description>
            )}
            {reason === undefined &&
            (kind === 'date' || kind === 'dateTime') ? (
                <FieldDescription>
                    {dateFormatHint(kind, settings)}
                </FieldDescription>
            ) : null}
            {reason === undefined ? null : (
                <FieldDescription>{reason}</FieldDescription>
            )}
            {problem === undefined ? null : (
                // An alert, said when it appears or changes: not again while more is typed.
                <Problem plain={editor} id={`${id}-problem`}>
                    {problem.message}
                </Problem>
            )}
            {messages.map(({ tone, text }, index) => (
                <Description
                    // oxlint-disable-next-line react/no-array-index-key -- messages have no ids, and two can say the same
                    key={index}
                    plain={editor}
                    id={`${id}-message-${index}`}
                    className={cn('border-s-2 ps-1.5', TONES[tone].border)}
                >
                    {TONES[tone].say(text)}
                </Description>
            ))}
        </>
    )
    // Not a control: focus given to its id goes on to its first control.
    const focusable = {
        id,
        tabIndex: -1,
        onFocus: focusInto(
            'input:not([hidden]), textarea, button, a[href], [tabindex="0"]'
        ),
    }
    if (editor && !oneControl) {
        return (
            <FieldSet
                {...focusable}
                aria-describedby={describedBy || undefined}
                data-invalid={invalid || undefined}
                className="gap-2 data-invalid:text-dhis2-destructive"
            >
                <FieldLegend id={labelId} variant="label">
                    {title}
                </FieldLegend>
                {control}
                {parts}
            </FieldSet>
        )
    }
    if (editor) {
        return (
            <FieldRoot invalid={invalid} {...focusable}>
                <FieldLabel id={labelId}>{title}</FieldLabel>
                {control}
                {parts}
            </FieldRoot>
        )
    }
    if (kind === 'trueOnly') {
        // The house checkbox: the box, then its label and what describes it.
        return (
            <FieldRoot invalid={invalid} orientation="horizontal">
                {control}
                <FieldContent>
                    <FieldLabel id={labelId}>{title}</FieldLabel>
                    {parts}
                </FieldContent>
            </FieldRoot>
        )
    }
    return (
        <FieldRoot invalid={invalid}>
            {radios ? null : <FieldLabel id={labelId}>{title}</FieldLabel>}
            {control}
            {parts}
        </FieldRoot>
    )
}

import i18n from '@dhis2/d2-i18n'
import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import type { ValueMeta } from '@/components/dhis2-value-display'
import { cellKind } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field as FieldRoot,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import { Textarea } from '@/components/dhis2/ui/textarea'
import { DownloadLink } from './editors/FileEditor'
import type { EditorProblem } from './editors/popupEditors'
import { ChoiceInput, offeredOptions } from './kinds/ChoiceInput'
import { DateInput, dateFormatHint } from './kinds/DateInput'
import { EditorInput, useEditorCommits } from './kinds/EditorInput'
import { SearchInput, unknownName } from './kinds/SearchInput'
import { READ_ONLY_CLASS, TypedInput } from './kinds/TypedInput'
import { useDraft } from './useDraft'

type Tone = 'error' | 'warning' | 'info'

export interface ValueInputProps {
    /** Another value type, field mask or option set is another field, and replaces what was typed. */
    field: Field
    settings: ValueSettings
    label: string
    description?: string
    /** The value as DHIS2 stores it. */
    value: string | undefined
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
    /** The link to the stored file or image. */
    fileUrl?: string
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
    grouped: boolean
    id?: string
    className?: string
    children: ReactNode
}

const Description = ({ grouped, className, ...props }: PartProps) =>
    grouped ? (
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

const Problem = ({ grouped, ...props }: PartProps) =>
    grouped ? (
        <p role="alert" className="text-sm text-dhis2-destructive" {...props} />
    ) : (
        <FieldError {...props} />
    )

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
    value,
    onChange,
    required = false,
    readOnly,
    messages = [],
    hiddenOptions,
    valueName,
    fileUrl,
    id: givenId,
}: ValueInputProps): ReactNode => {
    const generatedId = useId()
    const id = givenId ?? generatedId
    const kind = cellKind(field)
    const typed = kind === 'text' || kind === 'number' || kind === 'time'
    const dated = kind === 'date' || kind === 'dateTime'
    const choice =
        kind === 'boolean' || kind === 'trueOnly' || kind === 'option'
    const edited =
        typed || dated || choice || kind === 'popup' || kind === 'search'
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
    // A pop-up editor has fields of its own, each labelled in it, which in a Field would all take the field's one
    // control id. Its parts are plain, and name and describe it as a group.
    const grouped = reason === undefined && kind === 'popup'
    const commits = useEditorCommits(value, onChange)
    const problem = draft.problem ?? (grouped ? commits.problem : undefined)
    const invalid =
        problem !== undefined || messages.some(({ tone }) => tone === 'error')
    const labelId = `${id}-label`
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
    let control: ReactNode
    if (grouped) {
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
            />
        )
    } else if (choice) {
        control = (
            <ChoiceInput
                id={id}
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
                        className={READ_ONLY_CLASS}
                    />
                )}
                {file && fileUrl !== undefined && value !== undefined ? (
                    <StoredFile
                        url={fileUrl}
                        image={field.valueType === 'IMAGE'}
                        name={shown}
                    />
                ) : null}
            </>
        )
    }

    const title = (
        <>
            {label}
            {required ? (
                <span aria-hidden="true" className="text-dhis2-destructive">
                    *
                </span>
            ) : null}
        </>
    )
    const parts = (
        <>
            {grouped ? (
                <Label id={labelId} className="w-fit leading-snug">
                    {title}
                    {required ? (
                        // The group's name is all a screen reader has to say it.
                        <span className="sr-only"> {i18n.t('required')}</span>
                    ) : null}
                </Label>
            ) : (
                <FieldLabel id={labelId}>{title}</FieldLabel>
            )}
            {control}
            {description === undefined ? null : (
                <Description grouped={grouped} id={`${id}-description`}>
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
                <Problem grouped={grouped} id={`${id}-problem`}>
                    {problem.message}
                </Problem>
            )}
            {messages.map(({ tone, text }, index) => (
                <Description
                    // oxlint-disable-next-line react/no-array-index-key -- messages have no ids, and two can say the same
                    key={index}
                    grouped={grouped}
                    id={`${id}-message-${index}`}
                    className={cn('border-s-2 ps-1.5', TONES[tone].border)}
                >
                    {TONES[tone].say(text)}
                </Description>
            ))}
        </>
    )
    return grouped ? (
        <div
            id={id}
            role="group"
            aria-labelledby={labelId}
            aria-describedby={describedBy || undefined}
            data-invalid={invalid || undefined}
            className="flex w-full flex-col gap-1 data-invalid:text-dhis2-destructive"
        >
            {parts}
        </div>
    ) : (
        <FieldRoot invalid={invalid} className="gap-1">
            {parts}
        </FieldRoot>
    )
}

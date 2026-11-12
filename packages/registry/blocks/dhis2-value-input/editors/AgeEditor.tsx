import i18n from '@dhis2/d2-i18n'
import { useId, useRef, useState } from 'react'
import {
    ageFromBirth,
    birthFromAge,
    checkStored,
    futureBirth,
    parseTyped,
    typedText,
} from '@/components/dhis2-value-types'
import type { Age, Field, ValueSettings } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { Input } from '@/components/dhis2/ui/input'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/dhis2/ui/input-group'
import { Label } from '@/components/dhis2/ui/label'
import { todayIso } from '@/components/dhis2-value-types'
import { DatePickerButton, dateFormatHint } from '../kinds/DateInput'
import type { FormEditorProps, PopupEditorProps } from './popupEditors'
import { EditorButtons, idList, saveOnCtrlEnter } from './EditorButtons'

// The date of birth is typed and shown as any date is: in the system calendar and date format.
const DATE: Field = { valueType: 'DATE' }
// Up to three digits, or none (zero): more would reach back past the calendar.
const WHOLE = /^\s*\d{0,3}\s*$/
const AGE_PARTS = ['years', 'months', 'days'] as const

type Part = 'birth' | keyof Age
interface Texts {
    years: string
    months: string
    days: string
}

const NO_TEXTS: Texts = { years: '', months: '', days: '' }

/** What the editor would save: a date of birth (null clears), or what is wrong, and in which field. */
interface Reading {
    value: string | null
    problem?: { message: string; part: Part }
}

/** The age of a date of birth that is a date up to today; undefined for none, or any other. */
const ageOf = (
    field: Field,
    birth: string | null,
    today: string
): Age | undefined =>
    birth === null || checkStored(field, birth) !== undefined || birth > today
        ? undefined
        : ageFromBirth(birth, today)

/** The age as the fields show it; empty for none. */
const textsOf = (age: Age | undefined): Texts =>
    age === undefined
        ? NO_TEXTS
        : {
              years: String(age.years),
              months: String(age.months),
              days: String(age.days),
          }

const readBirth = (
    text: string,
    settings: ValueSettings,
    today: string
): Reading => {
    const parsed = parseTyped(DATE, text, settings)
    if (!parsed.ok) {
        return {
            value: null,
            problem: { message: parsed.problem.message, part: 'birth' },
        }
    }
    const future =
        parsed.value === undefined
            ? undefined
            : futureBirth(parsed.value, today)
    return future === undefined
        ? { value: parsed.value ?? null }
        : { value: null, problem: { message: future, part: 'birth' } }
}

/** The parts as the cell keeps them when they cannot be saved; an empty part reads as the zero it counts as. */
const partsText = (texts: Texts) =>
    i18n.t('Years: {{years}}, months: {{months}}, days: {{days}}', {
        nsSeparator: '::',
        years: texts.years.trim() || '0',
        months: texts.months.trim() || '0',
        days: texts.days.trim() || '0',
        interpolation: { escapeValue: false },
    })

/** An empty part counts as zero; all three empty is no age. */
const readAge = (texts: Texts, field: Field, today: string): Reading => {
    if (AGE_PARTS.every((part) => texts[part].trim() === '')) {
        return { value: null }
    }
    const wrong = AGE_PARTS.find((part) => !WHOLE.test(texts[part]))
    if (wrong !== undefined) {
        return {
            value: null,
            problem: {
                message: i18n.t('Enter whole numbers of zero or more'),
                part: wrong,
            },
        }
    }
    const birth = birthFromAge(
        {
            years: Number(texts.years),
            months: Number(texts.months),
            days: Number(texts.days),
        },
        today
    )
    if (birth === undefined) {
        return {
            value: null,
            problem: {
                message: i18n.t('No date of birth is this age today'),
                part: 'days',
            },
        }
    }
    const bad = checkStored(field, birth)
    return bad === undefined
        ? { value: birth }
        : { value: null, problem: { message: bad.message, part: 'years' } }
}

/** The date (`YYYY-MM-DD`) an age is counted to; the device's date by default. */
interface Today {
    today?: string
}

/** The date of birth and the parts, each filling the other as it is typed, and each change reported. */
const useAge = ({
    field,
    value,
    settings,
    save,
    report,
    today = todayIso(),
}: Pick<PopupEditorProps, 'field' | 'value' | 'settings' | 'save' | 'report'> &
    Today) => {
    const id = useId()
    const problemId = useId()
    const birthRef = useRef<HTMLInputElement>(null)
    const [birth, setBirth] = useState(
        value === undefined ? '' : typedText(DATE, value, settings)
    )
    const [age, setAge] = useState(() =>
        textsOf(ageOf(field, value ?? null, today))
    )
    // The date of birth given, stored or typed: an age that is its age means it, not another day the age also reaches.
    const given = useRef(value ?? null)
    const [reading, setReading] = useState<Reading>({ value: value ?? null })
    // Said on a save that was refused, until the next change.
    const [shown, setShown] = useState<Reading['problem']>()

    /** Reports what was typed; `text` is what the cell keeps if it cannot be saved. */
    const settle = (next: Reading, text: string) => {
        setReading(next)
        setShown(undefined)
        report(
            next.value,
            next.problem === undefined
                ? undefined
                : { message: next.problem.message, text }
        )
    }
    // Text that cannot be read leaves the other fields as they were.
    const typeBirth = (text: string) => {
        setBirth(text)
        const next = readBirth(text, settings, today)
        if (next.problem === undefined) {
            given.current = next.value
            setAge(textsOf(ageOf(field, next.value, today)))
        }
        settle(next, text)
    }
    const typeAge = (part: keyof Age, text: string) => {
        const texts = { ...age, [part]: text }
        setAge(texts)
        let next = readAge(texts, field, today)
        const known = ageOf(field, given.current, today)
        if (
            next.value !== null &&
            known !== undefined &&
            AGE_PARTS.every((each) => Number(texts[each]) === known[each])
        ) {
            next = { value: given.current }
        }
        if (next.problem === undefined) {
            setBirth(
                next.value === null ? '' : typedText(DATE, next.value, settings)
            )
        }
        settle(next, partsText(texts))
    }
    const commit = () => {
        if (reading.problem === undefined) {
            save(reading.value)
            return
        }
        setShown(reading.problem)
        // Back to the field the message is about, whether Save was clicked or Ctrl+Enter pressed.
        document.getElementById(`${id}-${reading.problem.part}`)?.focus()
    }
    /** What each of the four fields shares; `describedBy` is what else describes it, `className` sizes it. */
    const fieldProps = (
        part: Part,
        {
            describedBy,
            invalid = false,
            className,
        }: { describedBy?: string; invalid?: boolean; className?: string }
    ) => ({
        id: `${id}-${part}`,
        // A date and whole numbers, in order on a right-to-left page too.
        dir: 'ltr',
        autoComplete: 'off',
        spellCheck: false,
        'aria-invalid': invalid || shown?.part === part ? true : undefined,
        'aria-describedby': idList(
            shown?.part === part && problemId,
            describedBy
        ),
        onKeyDown: saveOnCtrlEnter(commit),
        className: cn('rtl:text-right', className),
    })
    return {
        id,
        problemId,
        birthRef,
        birth,
        age,
        reading,
        shown,
        typeBirth,
        typeAge,
        commit,
        fieldProps,
    }
}

type AgeState = ReturnType<typeof useAge>

const AgeLabel = ({ editor, part }: { editor: AgeState; part: Part }) => {
    const labels = {
        birth: i18n.t('Date of birth'),
        years: i18n.t('Years'),
        months: i18n.t('Months'),
        days: i18n.t('Days'),
    }
    return <Label htmlFor={`${editor.id}-${part}`}>{labels[part]}</Label>
}

/** The refused save's message: under the date of birth, or under the parts, whichever it is about. */
const AgeProblem = ({
    editor: { shown, problemId },
    aboutBirth,
    className,
}: {
    editor: AgeState
    aboutBirth: boolean
    className: string
}) =>
    shown === undefined || (shown.part === 'birth') !== aboutBirth ? null : (
        <p
            id={problemId}
            role="alert"
            className={cn('text-dhis2-destructive', className)}
        >
            {shown.message}
        </p>
    )

/** Years, months and days, each with its label. */
const AgeParts = ({
    editor,
    describedBy,
    invalid,
    className,
    inputClassName,
}: {
    editor: AgeState
    describedBy?: string
    invalid?: boolean
    className?: string
    inputClassName?: string
}) =>
    AGE_PARTS.map((part) => (
        <div key={part} className={cn('flex flex-col gap-1', className)}>
            <AgeLabel editor={editor} part={part} />
            <Input
                {...editor.fieldProps(part, {
                    describedBy,
                    invalid,
                    className: inputClassName,
                })}
                value={editor.age[part]}
                inputMode="numeric"
                onChange={({ target }) => editor.typeAge(part, target.value)}
            />
        </div>
    ))

/**
 * An age stored as its date of birth, edited as that date (typed in the system calendar and date format) or as years,
 * months and days: typing in one fills the other. Parts left empty count as zero, and are not filled in for the
 * person. Each change is reported, not saved: Save, Ctrl+Enter or ⌘+Enter saves it, and one that cannot be saved
 * (a date in the future, a part that is not a whole number) keeps the editor open with its message. Reported, such a
 * change carries the date of birth or the parts as typed, for the cell to keep.
 */
export const AgeEditor = (props: PopupEditorProps & Today) => {
    const editor = useAge(props)
    const dense = 'h-(--dhis2-field-height-dense)'
    return (
        <>
            <div className="flex flex-col gap-1">
                <AgeLabel editor={editor} part="birth" />
                <Input
                    {...editor.fieldProps('birth', { className: dense })}
                    ref={editor.birthRef}
                    value={editor.birth}
                    placeholder={props.settings.dateFormat}
                    onChange={({ target }) => editor.typeBirth(target.value)}
                />
                <AgeProblem editor={editor} aboutBirth className="text-xs" />
            </div>
            <div className="grid grid-cols-3 gap-2">
                <AgeParts editor={editor} inputClassName={dense} />
            </div>
            <AgeProblem
                editor={editor}
                aboutBirth={false}
                className="text-xs"
            />
            <EditorButtons save={editor.commit} cancel={props.cancel} />
        </>
    )
}

/**
 * An age in a form, in one row: the date of birth with a "Choose date" button and its format under it, as the date
 * kind has, then years, months and days, which move under it together when there is no room beside it.
 */
export const AgeFormEditor = (props: FormEditorProps & Today) => {
    const editor = useAge(props)
    const { settings, describedBy, invalid } = props
    const hintId = useId()
    return (
        <>
            <div className="flex flex-wrap items-start gap-2">
                <div className="flex w-56 flex-col gap-1">
                    <AgeLabel editor={editor} part="birth" />
                    <InputGroup>
                        <InputGroupInput
                            {...editor.fieldProps('birth', {
                                describedBy: idList(hintId, describedBy),
                                invalid,
                            })}
                            ref={editor.birthRef}
                            value={editor.birth}
                            onChange={({ target }) =>
                                editor.typeBirth(target.value)
                            }
                        />
                        <InputGroupAddon align="inline-end">
                            <DatePickerButton
                                input={editor.birthRef}
                                date={
                                    editor.reading.value === null
                                        ? ''
                                        : typedText(
                                              DATE,
                                              editor.reading.value,
                                              settings
                                          )
                                }
                                settings={settings}
                                pick={editor.typeBirth}
                            />
                        </InputGroupAddon>
                    </InputGroup>
                    <p
                        id={hintId}
                        className="m-0 text-sm leading-normal text-dhis2-muted-foreground"
                    >
                        {dateFormatHint('date', settings)}
                    </p>
                    <AgeProblem
                        editor={editor}
                        aboutBirth
                        className="text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <AgeParts
                        editor={editor}
                        describedBy={describedBy}
                        invalid={invalid}
                        className="w-20"
                    />
                </div>
            </div>
            <AgeProblem
                editor={editor}
                aboutBirth={false}
                className="text-sm"
            />
        </>
    )
}

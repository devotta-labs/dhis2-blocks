import i18n from '@dhis2/d2-i18n'
import { useId, useRef, useState } from 'react'
import {
    checkStored,
    parseTyped,
    typedText,
} from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import { localToday } from '../../sources/expiry'
import type { PopupEditorProps } from '../popupEditors'
import { ageFromBirth, birthFromAge } from './age'
import type { Age } from './age'
import { EditorButtons, saveOnCtrlEnter } from './EditorButtons'

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
    return parsed.value !== undefined && parsed.value > today
        ? {
              value: null,
              problem: {
                  message: i18n.t(
                      'Enter a date of birth that is not in the future'
                  ),
                  part: 'birth',
              },
          }
        : { value: parsed.value ?? null }
}

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
    const bad = checkStored(field, birth)
    return bad === undefined
        ? { value: birth }
        : { value: null, problem: { message: bad.message, part: 'years' } }
}

interface AgeEditorProps extends PopupEditorProps {
    /** The date (`YYYY-MM-DD`) an age is counted to; the device's date by default. */
    today?: string
}

/**
 * An age stored as its date of birth, edited as that date (typed in the system calendar and date format) or as years,
 * months and days: typing in one fills the other. Parts left empty count as zero, and are not filled in for the
 * person. Each change is reported, not saved: Save, Ctrl+Enter or ⌘+Enter saves it, and one that cannot be saved
 * (a date in the future, a part that is not a whole number) keeps the editor open with its message.
 */
export const AgeEditor = ({
    field,
    value,
    settings,
    save,
    report,
    cancel,
    today = localToday(),
}: AgeEditorProps) => {
    const id = useId()
    const problemId = useId()
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

    const settle = (next: Reading) => {
        setReading(next)
        setShown(undefined)
        report(next.value, next.problem?.message)
    }
    // Text that cannot be read leaves the other fields as they were.
    const typeBirth = (text: string) => {
        setBirth(text)
        const next = readBirth(text, settings, today)
        if (next.problem === undefined) {
            given.current = next.value
            setAge(textsOf(ageOf(field, next.value, today)))
        }
        settle(next)
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
        settle(next)
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

    const labels = {
        birth: i18n.t('Date of birth'),
        years: i18n.t('Years'),
        months: i18n.t('Months'),
        days: i18n.t('Days'),
    }
    const fieldProps = (part: Part) => ({
        id: `${id}-${part}`,
        autoComplete: 'off',
        spellCheck: false,
        'aria-invalid': shown?.part === part ? true : undefined,
        'aria-describedby': shown?.part === part ? problemId : undefined,
        onKeyDown: saveOnCtrlEnter(commit),
        className: 'h-(--dhis2-field-height-dense)',
    })
    // Under the date of birth, or under the parts, whichever the refused save is about.
    const problem = (aboutBirth: boolean) =>
        shown === undefined ||
        (shown.part === 'birth') !== aboutBirth ? null : (
            <p
                id={problemId}
                role="alert"
                className="text-xs text-dhis2-red-700"
            >
                {shown.message}
            </p>
        )
    return (
        <>
            <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-birth`}>{labels.birth}</Label>
                <Input
                    {...fieldProps('birth')}
                    value={birth}
                    placeholder={settings.dateFormat}
                    onChange={({ target }) => typeBirth(target.value)}
                />
                {problem(true)}
            </div>
            <div className="grid grid-cols-3 gap-2">
                {AGE_PARTS.map((part) => (
                    <div key={part} className="flex flex-col gap-1">
                        <Label htmlFor={`${id}-${part}`}>{labels[part]}</Label>
                        <Input
                            {...fieldProps(part)}
                            value={age[part]}
                            inputMode="numeric"
                            onChange={({ target }) =>
                                typeAge(part, target.value)
                            }
                        />
                    </div>
                ))}
            </div>
            {problem(false)}
            <EditorButtons save={commit} cancel={cancel} />
        </>
    )
}

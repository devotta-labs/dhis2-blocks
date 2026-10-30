import type { Dhis2Calendar } from '@/components/dhis2-value-display/calendar'
import type { TimelineOrder, TimelineStatus } from '@/components/timeline'
import type { ReactNode } from 'react'
import type { DataConfig } from './fakeHistory'

export interface ViewConfig {
    status: TimelineStatus
    errorNotice: boolean
    warningNotice: boolean
    infoNotice: boolean
    order: TimelineOrder
    groupBy: 'day' | 'none' | 'month' | 'program'
    calendar: Dhis2Calendar
    locale: string
    rtl: boolean
    /** Days to move "now" from the real today; the history stays put. */
    shift: number
    /** Past entries per "Show older entries"; 0 shows them all. */
    step: number
    renderer: 'standard' | 'actions' | 'compact'
    width: 'phone' | 'panel' | 'page'
    /** Hovering a part outlines it and says where it comes from. */
    inspect: boolean
}

export const DEFAULT_VIEW: ViewConfig = {
    status: 'success',
    errorNotice: false,
    warningNotice: false,
    infoNotice: false,
    order: 'desc',
    groupBy: 'day',
    calendar: 'gregorian',
    locale: 'en',
    rtl: false,
    shift: 0,
    step: 10,
    renderer: 'actions',
    width: 'panel',
    inspect: false,
}

const CALENDARS: Dhis2Calendar[] = [
    'gregorian',
    'iso8601',
    'ethiopian',
    'coptic',
    'islamic',
    'nepali',
    'persian',
    'thai',
]

const LOCALES = ['en', 'fr', 'es', 'pt', 'ar', 'am', 'ne', 'th', 'fa', 'hi']

export const Section = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) => (
    <fieldset className="flex flex-col gap-1.5 border-t border-dhis2-grey-300 pt-3">
        <legend className="pe-2 text-xs font-medium tracking-wide text-dhis2-grey-700 uppercase">
            {title}
        </legend>
        {children}
    </fieldset>
)

const Check = ({
    checked,
    onChange,
    children,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    children: ReactNode
}) => (
    <label className="flex items-center gap-2 text-sm">
        <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
        {children}
    </label>
)

const NumberField = ({
    label,
    value,
    onChange,
    min = 0,
    max = 500,
}: {
    label: string
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
}) => (
    <label className="flex items-center justify-between gap-2 text-sm">
        {label}
        <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(event) =>
                onChange(
                    Math.min(max, Math.max(min, Number(event.target.value)))
                )
            }
            className="w-20 rounded border border-dhis2-grey-500 px-1.5 py-0.5"
        />
    </label>
)

const Choice = <T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: T
    options: ReadonlyArray<T>
    onChange: (value: T) => void
}) => (
    <label className="flex items-center justify-between gap-2 text-sm">
        {label}
        <select
            value={value}
            onChange={(event) =>
                onChange(
                    options.find((option) => option === event.target.value) ??
                        value
                )
            }
            className="w-36 rounded border border-dhis2-grey-500 px-1 py-0.5"
        >
            {options.map((option) => (
                <option key={option}>{option}</option>
            ))}
        </select>
    </label>
)

export const DataControls = ({
    data,
    set,
}: {
    data: DataConfig
    set: <K extends keyof DataConfig>(key: K, value: DataConfig[K]) => void
}) => (
    <>
        <Section title="Events">
            <NumberField
                label="Programs"
                value={data.programs}
                min={1}
                max={3}
                onChange={(value) => set('programs', value)}
            />
            <NumberField
                label="Past"
                value={data.past}
                onChange={(value) => set('past', value)}
            />
            <NumberField
                label="Upcoming"
                value={data.upcoming}
                max={50}
                onChange={(value) => set('upcoming', value)}
            />
            <NumberField
                label="Overdue"
                value={data.overdue}
                max={50}
                onChange={(value) => set('overdue', value)}
            />
            <NumberField
                label="Skipped"
                value={data.skipped}
                max={50}
                onChange={(value) => set('skipped', value)}
            />
            <NumberField
                label="Values shown"
                value={data.values}
                max={10}
                onChange={(value) => set('values', value)}
            />
            <Choice
                label="Notes on events"
                value={data.eventNotes}
                options={['none', 'one', 'several'] as const}
                onChange={(value) => set('eventNotes', value)}
            />
            <Choice
                label="Show changes"
                value={data.changes}
                options={
                    [
                        'edited',
                        'none',
                        'slow',
                        'loading',
                        'error',
                        'unsupported',
                        'truncated',
                    ] as const
                }
                onChange={(value) => set('changes', value)}
            />
            <Check
                checked={data.dateOnly}
                onChange={(on) => set('dateOnly', on)}
            >
                Stored as dates only
            </Check>
            <Check checked={data.undated} onChange={(on) => set('undated', on)}>
                An undated event
            </Check>
        </Section>
        <Section title="Enrollment and profile">
            <Choice
                label="Enrollment"
                value={data.enrollment}
                options={['ACTIVE', 'COMPLETED', 'CANCELLED', 'none'] as const}
                onChange={(value) => set('enrollment', value)}
            />
            <NumberField
                label="Enrollment notes"
                value={data.enrollmentNotes}
                max={50}
                onChange={(value) => set('enrollmentNotes', value)}
            />
            <NumberField
                label="Profile changes"
                value={data.attributeChanges}
                max={100}
                onChange={(value) => set('attributeChanges', value)}
            />
        </Section>
        <Section title="Rough edges">
            <Check
                checked={data.noMetadata}
                onChange={(on) => set('noMetadata', on)}
            >
                Program metadata failed
            </Check>
            <Check
                checked={data.longText}
                onChange={(on) => set('longText', on)}
            >
                Long names and notes
            </Check>
            <NumberField
                label="Seed"
                value={data.seed}
                min={1}
                max={9999}
                onChange={(value) => set('seed', value)}
            />
        </Section>
    </>
)

export const ViewControls = ({
    view,
    set,
}: {
    view: ViewConfig
    set: <K extends keyof ViewConfig>(key: K, value: ViewConfig[K]) => void
}) => (
    <>
        <Section title="State">
            <Choice
                label="Status"
                value={view.status}
                options={['success', 'pending', 'error'] as const}
                onChange={(value) => set('status', value)}
            />
            <Check
                checked={view.errorNotice}
                onChange={(on) => set('errorNotice', on)}
            >
                A part failed (with retry)
            </Check>
            <Check
                checked={view.warningNotice}
                onChange={(on) => set('warningNotice', on)}
            >
                Events capped
            </Check>
            <Check
                checked={view.infoNotice}
                onChange={(on) => set('infoNotice', on)}
            >
                Changes unsupported
            </Check>
        </Section>
        <Section title="Layout">
            <Choice
                label="Order"
                value={view.order}
                options={['desc', 'asc'] as const}
                onChange={(value) => set('order', value)}
            />
            <Choice
                label="Group by"
                value={view.groupBy}
                options={['day', 'none', 'month', 'program'] as const}
                onChange={(value) => set('groupBy', value)}
            />
            <Choice
                label="Entries"
                value={view.renderer}
                options={['standard', 'actions', 'compact'] as const}
                onChange={(value) => set('renderer', value)}
            />
            <Choice
                label="Width"
                value={view.width}
                options={['phone', 'panel', 'page'] as const}
                onChange={(value) => set('width', value)}
            />
            <NumberField
                label="Show older step (0 = all)"
                value={view.step}
                max={200}
                onChange={(value) => set('step', value)}
            />
        </Section>
        <Section title="Time and language">
            <NumberField
                label="Move now (days)"
                value={view.shift}
                min={-365}
                max={365}
                onChange={(value) => set('shift', value)}
            />
            <Choice
                label="Calendar"
                value={view.calendar}
                options={CALENDARS}
                onChange={(value) => set('calendar', value)}
            />
            <Choice
                label="Locale"
                value={view.locale}
                options={LOCALES}
                onChange={(value) => set('locale', value)}
            />
            <Check checked={view.rtl} onChange={(on) => set('rtl', on)}>
                Right to left
            </Check>
        </Section>
    </>
)

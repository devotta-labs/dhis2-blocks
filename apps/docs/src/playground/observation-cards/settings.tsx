import { Check, Disclosure, NumberRow, Section, SelectRow } from '../controls'
import {
    CARD_ELEMENTS,
    ELEMENT_CHOICES,
    elementSpec,
    elementTitle,
    type LabCard,
    type LabSettings,
} from './labData'

type Change = (changes: Partial<LabSettings>) => void

/** The person's visits, which every card's readings come from. */
export const VisitControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Visits">
        <NumberRow
            label="Visits"
            value={settings.visits}
            max={500}
            onChange={(visits) => onChange({ visits })}
        />
        <Check
            checked={settings.irregularVisits}
            onChange={(irregularVisits) => onChange({ irregularVisits })}
        >
            Irregular gaps between visits
        </Check>
        <NumberRow
            label="Days since last visit"
            value={settings.daysSinceLast}
            max={3650}
            onChange={(daysSinceLast) => onChange({ daysSinceLast })}
        />
        <NumberRow
            label="Enrollments"
            value={settings.enrollments}
            min={1}
            max={3}
            onChange={(enrollments) => onChange({ enrollments })}
        />
        <Check
            checked={settings.unreadableStage}
            onChange={(unreadableStage) => onChange({ unreadableStage })}
        >
            Review stage unreadable (every 4th visit)
        </Check>
        <Check
            checked={settings.scheduledSkipped}
            onChange={(scheduledSkipped) => onChange({ scheduledSkipped })}
        >
            Scheduled and skipped events mixed in
        </Check>
    </Section>
)

/** One card's data element and its readings; only the rows that apply to its type show. */
const CardData = ({
    card,
    onChange,
}: {
    card: LabCard
    onChange: (changes: Partial<LabCard>) => void
}) => {
    const spec = elementSpec(card.element)
    const hasBands = spec.domain?.bands !== undefined
    const hasSpread = spec.domain !== undefined || spec.valueType === 'BOOLEAN'
    return (
        <>
            <SelectRow
                label="Data element"
                value={card.element}
                options={ELEMENT_CHOICES}
                onChange={(element) => onChange({ element })}
            />
            {hasSpread ? (
                <SelectRow
                    label="Values"
                    value={card.spread}
                    options={[
                        ['steady', 'Steady'],
                        ['flat', 'Same every visit'],
                        [
                            'climbing',
                            hasBands ? 'Climbing through legends' : 'Climbing',
                        ],
                        ['jumpy', 'Jumpy'],
                    ]}
                    onChange={(spread) => onChange({ spread })}
                />
            ) : null}
            {hasBands ? (
                <Check
                    checked={card.legendSet}
                    onChange={(legendSet) => onChange({ legendSet })}
                >
                    Legend set
                </Check>
            ) : null}
            {spec.options ? (
                <Check
                    checked={card.optionColours}
                    onChange={(optionColours) => onChange({ optionColours })}
                >
                    Option colours
                </Check>
            ) : null}
            {spec.valueType === 'TRUE_ONLY' ? (
                <Check
                    checked={card.trueOnlyUntick}
                    onChange={(trueOnlyUntick) => onChange({ trueOnlyUntick })}
                >
                    Unticked at the latest visit
                </Check>
            ) : null}
            <Check
                checked={card.neverRecorded}
                onChange={(neverRecorded) => onChange({ neverRecorded })}
            >
                Never recorded
            </Check>
            <Check
                checked={card.longLabel}
                onChange={(longLabel) => onChange({ longLabel })}
            >
                Long label and unit
            </Check>
            <Check
                checked={card.notInProgram}
                onChange={(notInProgram) => onChange({ notInProgram })}
            >
                Asks for a data element not in the program
            </Check>
        </>
    )
}

/** Each card's data, folded under its name so it's clear which card a row changes. */
export const CardDataControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Data per card">
        {settings.cards.map((card, index) => (
            <Disclosure
                key={CARD_ELEMENTS[index]}
                defaultOpen={index === 0}
                summary={`Card ${index + 1} · ${elementTitle(card.element)}`}
            >
                <CardData
                    card={card}
                    onChange={(changes) =>
                        onChange({
                            cards: settings.cards.map((each, position) =>
                                position === index
                                    ? { ...each, ...changes }
                                    : each
                            ),
                        })
                    }
                />
            </Disclosure>
        ))}
    </Section>
)

export const ServerControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Server">
        <SelectRow
            label="System calendar"
            value={settings.calendar}
            options={[
                ['gregorian', 'Gregorian'],
                ['iso8601', 'ISO 8601'],
                ['ethiopian', 'Ethiopian'],
                ['nepali', 'Nepali'],
                ['coptic', 'Coptic'],
                ['islamic', 'Islamic'],
                ['persian', 'Persian'],
                ['thai', 'Thai'],
            ]}
            onChange={(calendar) => onChange({ calendar })}
        />
    </Section>
)

/** Every card's props and the lab's layout around them; the block keeps its own look. */
export const CardControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: Change
}) => (
    <Section title="Props and layout">
        <SelectRow
            label="Card"
            value={settings.arrangement}
            options={[
                ['default', 'Default arrangement'],
                ['composed', 'Composed parts'],
            ]}
            onChange={(arrangement) => onChange({ arrangement })}
        />
        <NumberRow
            label="staleAfterDays (0 off)"
            value={settings.staleAfterDays}
            max={3650}
            onChange={(staleAfterDays) => onChange({ staleAfterDays })}
        />
        <NumberRow
            label="Card width"
            value={settings.cardWidth}
            min={160}
            max={480}
            suffix="px"
            onChange={(cardWidth) => onChange({ cardWidth })}
        />
        <NumberRow
            label="Cards per row"
            value={settings.cardsPerRow}
            min={1}
            max={4}
            onChange={(cardsPerRow) => onChange({ cardsPerRow })}
        />
    </Section>
)

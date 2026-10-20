import { EventFormField, useEventFormRules } from '@dhis2-blocks/event-form'
import { ErrorAlert } from '@dhis2-blocks/ui/alert'
import { Spinner } from '@dhis2-blocks/ui/spinner'
import React, { useId, useState, type ReactNode } from 'react'
import i18n from '../../../i18n'
import { fieldLens, type EffectKind } from './effects'
import { RuleCondition } from './RuleCondition'
import {
    kindTag,
    listOf,
    raw,
    RuleName,
    showValue,
    useLens,
    wouldDo,
} from './RulesLensContext'

type Tone = 'hidden' | 'acting' | 'dormant' | 'controls'

const toneClass = {
    hidden: 'border-dhis2-yellow-300 bg-dhis2-yellow-050 text-dhis2-yellow-900',
    acting: 'border-dhis2-blue-200 bg-dhis2-blue-050 text-dhis2-blue-900',
    dormant: 'border-dhis2-grey-300 bg-dhis2-grey-050 text-dhis2-grey-800',
    controls: 'border-dhis2-teal-200 bg-dhis2-teal-050 text-dhis2-teal-900',
} satisfies Record<Tone, string>

const Tag = ({
    tone,
    open,
    controls,
    onClick,
    children,
}: {
    tone: Tone
    open: boolean
    controls: string
    onClick: () => void
    children: ReactNode
}) => (
    <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onClick}
        className={`cursor-pointer rounded-dhis2-sm border px-1.5 py-px text-xs font-medium outline-none hover:underline focus-visible:outline-2 focus-visible:outline-dhis2-ring ${toneClass[tone]}`}
    >
        {children}
    </button>
)

/** What an acting rule does to the field, to put before the rule's name. */
const actingVerb = (kinds: readonly EffectKind[]) => {
    if (kinds.includes('hidden')) {
        return i18n.t('Hidden by')
    }
    if (kinds.includes('assigned')) {
        return i18n.t('Calculated by')
    }
    if (kinds.includes('mandatory')) {
        return i18n.t('Required by')
    }
    if (kinds.includes('error') || kinds.includes('warning')) {
        return i18n.t('Message from')
    }
    if (kinds.includes('options')) {
        return i18n.t('Options limited by')
    }
    return i18n.t('Changed by')
}

/** The box under a field that says which rules shape it, why, and what it feeds. */
const Explanation = ({ id, fieldId }: { id: string; fieldId: string }) => {
    const { effects, graph, explain } = useEventFormRules()
    const { metadata, label, ruleName } = useLens()
    const lens = fieldLens(effects, graph, explain, fieldId)
    const assigned = effects?.assignedValues.get(fieldId)
    return (
        <div
            id={id}
            className="flex flex-col gap-3 rounded-dhis2-sm bg-dhis2-grey-100 p-3 text-sm"
            data-testid="rules-lens-explanation"
        >
            {lens.acting.map(({ by, kinds }) => (
                <div key={by.actionId} className="flex flex-col gap-1">
                    <p className="m-0 font-medium text-dhis2-grey-900">
                        {actingVerb(kinds)} <RuleName>{by.ruleName}</RuleName>
                    </p>
                    {kinds.includes('assigned') && assigned ? (
                        <p className="m-0 text-dhis2-grey-800">
                            {i18n.t('Value: {{value}}', {
                                value: showValue(assigned.value),
                                interpolation: raw,
                            })}
                        </p>
                    ) : null}
                    <RuleCondition condition={by.condition} met />
                </div>
            ))}
            {lens.dormant.map((ruleId) => {
                const rule = metadata?.rules.get(ruleId)
                return (
                    <div key={ruleId} className="flex flex-col gap-1">
                        <p className="m-0 font-medium text-dhis2-grey-900">
                            <RuleName>{ruleName(ruleId)}</RuleName>{' '}
                            <span className="font-normal text-dhis2-grey-700">
                                {wouldDo(rule?.actionTypes)}
                            </span>
                        </p>
                        {rule ? (
                            <RuleCondition
                                condition={rule.condition}
                                met={false}
                            />
                        ) : null}
                    </div>
                )
            })}
            {lens.controllers.length > 0 ? (
                <div className="flex flex-col gap-1">
                    <p className="m-0 font-medium text-dhis2-grey-900">
                        {i18n.t('Rules that read this answer')}
                    </p>
                    <ul className="m-0 flex list-disc flex-col gap-0.5 ps-5 text-dhis2-grey-800">
                        {lens.controllers.map((ruleId) => {
                            const writes =
                                graph?.rules.get(ruleId)?.writesFields ?? []
                            return (
                                <li key={ruleId}>
                                    <RuleName>{ruleName(ruleId)}</RuleName>
                                    {writes.length === 0
                                        ? null
                                        : ` → ${listOf(writes.map(label))}`}
                                </li>
                            )
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    )
}

/** One field with its rule tags, or a placeholder where a rule hides it. */
const LensField = ({ fieldId }: { fieldId: string }) => {
    const { effects, graph, explain } = useEventFormRules()
    const { label } = useLens()
    const [open, setOpen] = useState(false)
    const explanationId = useId()
    const lens = fieldLens(effects, graph, explain, fieldId)
    const kinds = [...new Set(lens.acting.flatMap(({ kinds }) => kinds))]
    const hidden = kinds.includes('hidden')
    const toggle = () => setOpen((current) => !current)
    const tag = (tone: Tone, text: string) => (
        <Tag
            key={text}
            tone={tone}
            open={open}
            controls={explanationId}
            onClick={toggle}
        >
            {text}
        </Tag>
    )
    const tags = [
        ...kinds.map((kind) =>
            tag(kind === 'hidden' ? 'hidden' : 'acting', kindTag(kind))
        ),
        ...(kinds.length === 0 && lens.dormant.length > 0
            ? [tag('dormant', i18n.t('Rules can change this'))]
            : []),
        ...(lens.controls.length > 0
            ? [
                  tag(
                      'controls',
                      lens.controls.length === 1
                          ? i18n.t('Controls 1 field')
                          : i18n.t('Controls {{count}} fields', {
                                count: lens.controls.length,
                            })
                  ),
              ]
            : []),
    ]

    if (hidden) {
        return (
            <div
                className="flex flex-col gap-2 rounded-dhis2-sm border border-dashed border-dhis2-grey-400 px-3 py-2"
                data-testid="rules-lens-hidden-field"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-dhis2-grey-700">
                        {label(fieldId)}
                    </span>
                    <span className="flex flex-wrap gap-1">{tags}</span>
                </div>
                {open ? (
                    <Explanation id={explanationId} fieldId={fieldId} />
                ) : null}
            </div>
        )
    }
    if (tags.length === 0) {
        return <EventFormField id={fieldId} />
    }
    return (
        // Boxed so the tags read as belonging to this field, not the one above or below.
        <div
            className="flex flex-col gap-1 rounded-dhis2-sm border border-dhis2-grey-400 px-3 pt-2 pb-3"
            data-testid="rules-lens-field"
        >
            <span className="flex flex-wrap justify-end gap-1">{tags}</span>
            <EventFormField id={fieldId} />
            {open ? <Explanation id={explanationId} fieldId={fieldId} /> : null}
        </div>
    )
}

/**
 * The stage's sections with every field a rule touches tagged: click a tag to see the rules
 * behind it. Fields a rule hides stay in place as placeholders. Use it in place of
 * `EventFormSections` while the lens is on.
 */
export const RulesLensSections = () => {
    const { effects } = useEventFormRules()
    const { metadata, metadataError, sectionName } = useLens()
    const [openSection, setOpenSection] = useState<string>()
    if (metadataError) {
        return (
            <ErrorAlert title={i18n.t('Could not load the rules lens')}>
                {metadataError.message}
            </ErrorAlert>
        )
    }
    if (metadata === undefined) {
        return <Spinner aria-label={i18n.t('Loading')} />
    }
    return (
        <>
            {metadata.sections.map((section) => {
                const hiddenBy = effects?.hiddenSections.get(section.id)
                if (hiddenBy !== undefined && hiddenBy.length > 0) {
                    const isOpen = openSection === section.id
                    return (
                        <section
                            key={section.id}
                            className="flex flex-col gap-2 rounded-dhis2-md border border-dashed border-dhis2-grey-400 p-4"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-dhis2-grey-700">
                                    {sectionName(section.id)}
                                </span>
                                <Tag
                                    tone="hidden"
                                    open={isOpen}
                                    controls={`rules-lens-section-${section.id}`}
                                    onClick={() =>
                                        setOpenSection(
                                            isOpen ? undefined : section.id
                                        )
                                    }
                                >
                                    {i18n.t('Hidden')}
                                </Tag>
                            </div>
                            {isOpen ? (
                                <div
                                    id={`rules-lens-section-${section.id}`}
                                    className="flex flex-col gap-3 rounded-dhis2-sm bg-dhis2-grey-100 p-3 text-sm"
                                >
                                    {hiddenBy.map((by) => (
                                        <div
                                            key={by.actionId}
                                            className="flex flex-col gap-1"
                                        >
                                            <p className="m-0 font-medium">
                                                {actingVerb(['hidden'])}{' '}
                                                <RuleName>
                                                    {by.ruleName}
                                                </RuleName>
                                            </p>
                                            <RuleCondition
                                                condition={by.condition}
                                                met
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </section>
                    )
                }
                return (
                    <section
                        key={section.id}
                        data-section-id={section.id}
                        className="flex flex-col gap-4 rounded-dhis2-md bg-dhis2-card p-4 text-dhis2-card-foreground shadow-dhis2-card"
                    >
                        {section.name ? (
                            <h2 className="m-0 text-base leading-snug font-medium text-dhis2-grey-900">
                                {section.name}
                            </h2>
                        ) : null}
                        {section.fieldIds.map((fieldId) => (
                            <LensField key={fieldId} fieldId={fieldId} />
                        ))}
                    </section>
                )
            })}
        </>
    )
}

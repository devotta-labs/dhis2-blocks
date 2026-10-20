import React from 'react'
import i18n from '../../../i18n'
import { parseCondition } from './condition'
import { useLens } from './RulesLensContext'

/**
 * A rule condition with the operators spelled out and each answer it reads shown by its label
 * and current value, then whether it holds now. The raw expression is one click away.
 */
export const RuleCondition = ({
    condition,
    met,
}: {
    condition: string
    met: boolean
}) => {
    const { metadata, label, answer } = useLens()
    const parts = parseCondition(condition, metadata?.variables ?? new Map())
    return (
        <div className="flex flex-col gap-1">
            <p className="m-0 leading-relaxed">
                {parts.map((part, index) =>
                    part.kind === 'text' ? (
                        <span key={index} className="text-dhis2-grey-800">
                            {part.text}
                        </span>
                    ) : part.fieldId === undefined ? (
                        <span
                            key={index}
                            className="font-medium text-dhis2-grey-900"
                        >
                            {part.name.replaceAll('_', ' ')}
                        </span>
                    ) : (
                        <span
                            key={index}
                            className="rounded-dhis2-sm bg-dhis2-blue-050 px-1 py-px text-dhis2-blue-900"
                        >
                            {label(part.fieldId)}
                            {answer(part.fieldId) === undefined ? null : (
                                <span className="text-dhis2-blue-700">
                                    {' '}
                                    ({i18n.t('now')}: {answer(part.fieldId)})
                                </span>
                            )}
                        </span>
                    )
                )}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                    className={
                        met
                            ? 'font-medium text-dhis2-green-800'
                            : 'font-medium text-dhis2-grey-700'
                    }
                >
                    {met ? i18n.t('Condition met now') : i18n.t('Not met now')}
                </span>
                <details className="text-dhis2-grey-700">
                    <summary className="cursor-pointer">
                        {i18n.t('Expression')}
                    </summary>
                    <code className="mt-1 block rounded-dhis2-sm bg-dhis2-grey-100 px-2 py-1 font-mono break-words whitespace-pre-wrap text-dhis2-grey-900">
                        {condition}
                    </code>
                </details>
            </div>
        </div>
    )
}

import type { RuleContext } from '@/registry/program-rules/use-program-rules'
import React from 'react'
import i18n from '../../i18n'

const yesNo = (value: boolean) => (value ? i18n.t('Yes') : i18n.t('No'))

/** What the rules need from the host, and the rules the engine cannot parse. */
export const RuleIssues = ({ context }: { context: RuleContext }) => {
    const { invalidRules, requirements } = context
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 [@media(max-width:900px)]:grid-cols-1">
            <section
                className="self-start rounded-dhis2-sm bg-white p-4 shadow-dhis2-card"
                aria-labelledby="rules-graph-requirements"
                data-testid="rules-graph-requirements"
            >
                <h2
                    id="rules-graph-requirements"
                    className="mt-0 mb-3 text-base font-medium"
                >
                    {i18n.t('Data requirements')}
                </h2>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-dhis2-grey-700">
                        {i18n.t('Enrollment')}
                    </dt>
                    <dd className="m-0">{yesNo(requirements.enrollment)}</dd>
                    <dt className="text-dhis2-grey-700">
                        {i18n.t('Other events')}
                    </dt>
                    <dd className="m-0">{yesNo(requirements.otherEvents)}</dd>
                    <dt className="text-dhis2-grey-700">
                        {i18n.t('Org unit groups')}
                    </dt>
                    <dd className="m-0 font-mono text-xs leading-5">
                        {requirements.orgUnitGroups.length > 0
                            ? requirements.orgUnitGroups.join(', ')
                            : i18n.t('None')}
                    </dd>
                </dl>
            </section>
            <section
                className="rounded-dhis2-sm bg-white p-4 shadow-dhis2-card"
                aria-labelledby="rules-graph-invalid"
                data-testid="rules-graph-invalid"
            >
                <h2
                    id="rules-graph-invalid"
                    className="mt-0 mb-1 text-base font-medium"
                >
                    {i18n.t('Invalid rules ({{count}})', {
                        count: invalidRules.length,
                    })}
                </h2>
                <p className="mt-0 mb-3 text-sm text-dhis2-grey-700">
                    {i18n.t(
                        'The engine cannot parse these expressions. A bad condition leaves the rule out of the graph; a bad action expression leaves out only that action.'
                    )}
                </p>
                {invalidRules.length === 0 ? (
                    <p className="m-0 text-sm text-dhis2-grey-600">
                        {i18n.t('None')}
                    </p>
                ) : (
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                        {invalidRules.map((invalid) => (
                            <li
                                key={`${invalid.ruleId}/${invalid.actionId ?? ''}`}
                                className="flex flex-col gap-1 border-l-2 border-dhis2-red-300 pl-2"
                            >
                                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                                    <span className="font-medium">
                                        {invalid.ruleName}
                                    </span>
                                    <span className="text-xs text-dhis2-grey-600">
                                        {invalid.actionId === undefined
                                            ? i18n.t('Condition')
                                            : i18n.t('Action {{id}}', {
                                                  id: invalid.actionId,
                                              })}
                                    </span>
                                </div>
                                <code className="rounded-dhis2-sm bg-dhis2-grey-200 px-2 py-1 font-mono text-xs break-words whitespace-pre-wrap">
                                    {invalid.expression}
                                </code>
                                <span className="text-xs text-dhis2-red-700">
                                    {invalid.message}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

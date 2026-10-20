import { useProgramRuleContext } from '@/registry/program-rules/use-program-rules'
import { useDataEngine } from '@dhis2/app-runtime'
import {
    ClearSelections,
    ContextSelector,
    ProgramSelector,
    StageSelector,
    type Option,
} from '@dhis2-blocks/context-selector'
import { ErrorAlert } from '@dhis2-blocks/ui/alert'
import { Spinner } from '@dhis2-blocks/ui/spinner'
import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { createAppWorkingListClient } from '../AppShell/createAppWorkingListClient'
import { edgeStyle, type EdgeCategory } from './edgeStyles'
import { buildRulesGraphModel } from './graphModel'
import { NodeDetails } from './NodeDetails'
import { RuleIssues } from './RuleIssues'
import { RulesGraphCanvas } from './RulesGraphCanvas'
import { usePrograms, useProgramLabels } from './useProgramRulesGraphData'

type OpenSelector = 'program' | 'stage'

const LEGEND: EdgeCategory[] = [
    'read',
    'assign',
    'visibility',
    'mandatory',
    'error',
    'warning',
]

const Legend = () => (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-xs text-dhis2-grey-700">
        {LEGEND.map((category) => {
            const style = edgeStyle(category)
            return (
                <li key={category} className="flex items-center gap-1.5">
                    <svg width="28" height="8" aria-hidden="true">
                        <line
                            x1="0"
                            y1="4"
                            x2="28"
                            y2="4"
                            stroke={style.color}
                            strokeWidth="2"
                            strokeDasharray={style.dash}
                        />
                    </svg>
                    {style.label()}
                </li>
            )
        })}
        <li className="flex items-center gap-1.5">
            <svg width="28" height="8" aria-hidden="true">
                <line
                    x1="5"
                    y1="4"
                    x2="23"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="2"
                />
                <path d="M0 4 6 1v6zM28 4 22 1v6z" fill="currentColor" />
            </svg>
            {i18n.t('Checks a field it reads')}
        </li>
    </ul>
)

const Hint = ({ children }: { children: string }) => (
    <p className="m-0 text-sm text-dhis2-grey-700">{children}</p>
)

const StageRulesGraph = ({
    programId,
    programStageId,
    labels,
}: {
    programId: string
    programStageId: string
    labels: NonNullable<ReturnType<typeof useProgramLabels>['data']>
}) => {
    const { status, context, metadata, error } = useProgramRuleContext({
        programId,
        programStageId,
    })
    const [selection, setSelection] = useState<{ id: string; focus: boolean }>()
    const model = useMemo(
        () =>
            context && metadata
                ? buildRulesGraphModel(context, metadata, labels)
                : undefined,
        [context, metadata, labels]
    )

    if (status === 'error') {
        return (
            <ErrorAlert title={i18n.t('Could not load the program rules')}>
                {error?.message}
            </ErrorAlert>
        )
    }
    if (!context || !metadata || !model) {
        return (
            <div className="flex items-center gap-2 text-sm text-dhis2-grey-700">
                <Spinner />
                {i18n.t('Loading program rules…')}
            </div>
        )
    }

    const ruleCount = context.graph.rules.size
    const fieldCount = model.nodes.filter(
        (node) => node.kind === 'field'
    ).length
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p
                    className="m-0 text-sm text-dhis2-grey-700"
                    data-testid="rules-graph-summary"
                >
                    {i18n.t(
                        '{{rules}} rules, {{fields}} fields, {{invalid}} invalid',
                        {
                            rules: ruleCount,
                            fields: fieldCount,
                            invalid: context.invalidRules.length,
                        }
                    )}
                </p>
                <Legend />
            </div>
            {ruleCount === 0 ? (
                <Hint>
                    {i18n.t(
                        'This stage has no program rules the engine can run.'
                    )}
                </Hint>
            ) : (
                <div className="grid h-[max(560px,calc(100vh-260px))] grid-cols-[minmax(0,1fr)_380px] gap-4 [@media(max-width:900px)]:h-auto [@media(max-width:900px)]:grid-cols-1">
                    <div
                        className="min-h-[480px] overflow-hidden rounded-dhis2-sm bg-white shadow-dhis2-card"
                        data-testid="rules-graph-canvas"
                    >
                        <RulesGraphCanvas
                            model={model}
                            selectedId={selection?.id}
                            focusId={
                                selection?.focus ? selection.id : undefined
                            }
                            onSelect={(id) =>
                                setSelection(
                                    id ? { id, focus: false } : undefined
                                )
                            }
                        />
                    </div>
                    <aside className="overflow-y-auto rounded-dhis2-sm bg-white p-4 shadow-dhis2-card">
                        <NodeDetails
                            model={model}
                            context={context}
                            metadata={metadata}
                            selectedId={selection?.id}
                            onSelect={(id) =>
                                setSelection(
                                    id ? { id, focus: true } : undefined
                                )
                            }
                        />
                    </aside>
                </div>
            )}
            <RuleIssues context={context} />
        </>
    )
}

/**
 * Demo of a program stage's rule dependency graph, from metadata alone: which
 * fields each rule reads and what its actions write, in evaluation order.
 */
export const ProgramRulesGraphDemo = () => {
    const engine = useDataEngine()
    const client = useMemo(() => createAppWorkingListClient(engine), [engine])
    const [searchParams, setSearchParams] = useSearchParams()
    const programId = searchParams.get('program') ?? undefined
    const chosenStageId = searchParams.get('stage') ?? undefined
    const [openSelector, setOpenSelector] = useState<OpenSelector>()

    const programsQuery = usePrograms(client)
    const labelsQuery = useProgramLabels(client, programId)
    const programOptions = useMemo<Option[]>(
        () =>
            (programsQuery.data ?? []).map((program) => ({
                value: program.id,
                label: program.displayName,
            })),
        [programsQuery.data]
    )
    const stages = labelsQuery.data?.stages ?? []
    const stageOptions = stages.map((stage) => ({
        value: stage.id,
        label: stage.name,
    }))
    // An event program has one stage; there is nothing to choose.
    const programStageId =
        chosenStageId ?? (stages.length === 1 ? stages[0]?.id : undefined)

    const navigate = (next: { program?: string; stage?: string }) => {
        setOpenSelector(undefined)
        setSearchParams(
            Object.fromEntries(
                Object.entries(next).filter(
                    (entry): entry is [string, string] => entry[1] !== undefined
                )
            )
        )
    }

    return (
        <div
            className="min-h-screen w-full min-w-0 pb-10"
            data-testid="program-rules-graph-demo"
        >
            <ContextSelector ariaLabel={i18n.t('Program rules graph context')}>
                <ProgramSelector
                    label={i18n.t('Program')}
                    placeholder={i18n.t('Choose a program')}
                    searchPlaceholder={i18n.t('Search for a program')}
                    options={programOptions}
                    value={programId}
                    open={openSelector === 'program'}
                    onOpenChange={(open) =>
                        setOpenSelector(open ? 'program' : undefined)
                    }
                    onChange={(program) => navigate({ program })}
                    onClear={() => navigate({})}
                    loading={programsQuery.isPending}
                    loadingLabel={i18n.t('Loading programs…')}
                />
                {programId ? (
                    <StageSelector
                        label={i18n.t('Stage')}
                        placeholder={i18n.t('Choose a stage')}
                        options={stageOptions}
                        value={programStageId}
                        open={openSelector === 'stage'}
                        onOpenChange={(open) =>
                            setOpenSelector(open ? 'stage' : undefined)
                        }
                        onChange={(stage) =>
                            navigate({ program: programId, stage })
                        }
                        onClear={() => navigate({ program: programId })}
                        loading={labelsQuery.isPending}
                        loadingLabel={i18n.t('Loading stages…')}
                    />
                ) : null}
                <ClearSelections
                    onClear={() => navigate({})}
                    disabled={!programId}
                />
            </ContextSelector>

            <main className="mx-auto mt-4 flex w-full min-w-0 max-w-[1600px] flex-col gap-4 px-6 [@media(max-width:900px)]:px-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h1 className="m-0 text-2xl font-medium text-dhis2-grey-900">
                        {i18n.t('Program rules graph')}
                    </h1>
                    <a
                        className="text-sm font-medium text-dhis2-blue-600 underline-offset-2 hover:underline"
                        href="#/"
                    >
                        {i18n.t('Back to Working List')}
                    </a>
                </div>
                {programsQuery.error || labelsQuery.error ? (
                    <ErrorAlert title={i18n.t('Could not load the program')}>
                        {(programsQuery.error ?? labelsQuery.error)?.message}
                    </ErrorAlert>
                ) : null}
                {!programId ? (
                    <Hint>
                        {i18n.t(
                            'Choose a program and a stage to see how its program rules depend on each other: the fields each rule reads, and what its actions write.'
                        )}
                    </Hint>
                ) : !programStageId ? (
                    <Hint>
                        {i18n.t(
                            'Choose a stage. Rules for other stages are left out.'
                        )}
                    </Hint>
                ) : labelsQuery.data ? (
                    <StageRulesGraph
                        key={`${programId}/${programStageId}`}
                        programId={programId}
                        programStageId={programStageId}
                        labels={labelsQuery.data}
                    />
                ) : null}
            </main>
        </div>
    )
}

import { assignedVariable } from '@/registry/program-rules/index'
import type {
    ProgramRulesMetadata,
    RuleContext,
} from '@/registry/program-rules/use-program-rules'
import { Button } from '@dhis2-blocks/ui/button'
import React, { type ReactNode } from 'react'
import i18n from '../../i18n'
import { edgeStyle, edgeCategory } from './edgeStyles'
import {
    fieldNodeId,
    ruleActions,
    type GraphEdge,
    type GraphNode,
    type RulesGraphModel,
} from './graphModel'

interface NodeDetailsProps {
    model: RulesGraphModel
    context: RuleContext
    metadata: ProgramRulesMetadata
    selectedId?: string
    onSelect: (nodeId?: string) => void
}

const Section = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) => (
    <section className="flex flex-col gap-1.5">
        <h3 className="m-0 text-xs font-medium tracking-wide text-dhis2-grey-600 uppercase">
            {title}
        </h3>
        {children}
    </section>
)

const Code = ({ children }: { children: string }) => (
    <code className="block rounded-dhis2-sm bg-dhis2-grey-200 px-2 py-1.5 font-mono text-xs break-words whitespace-pre-wrap text-dhis2-grey-900">
        {children}
    </code>
)

const Empty = () => (
    <p className="m-0 text-sm text-dhis2-grey-600">{i18n.t('None')}</p>
)

const nodeTitle = (node: GraphNode) => {
    switch (node.kind) {
        case 'rule':
            return node.name
        case 'field':
            return node.label
        case 'variable':
            return `#{${node.name}}`
        default:
            return node.label
    }
}

const NodeLink = ({
    node,
    onSelect,
    suffix,
}: {
    node: GraphNode
    onSelect: (nodeId: string) => void
    suffix?: ReactNode
}) => (
    <li className="flex items-start gap-2">
        <Button
            variant="link"
            size="sm"
            className="h-auto min-h-7 min-w-0 shrink justify-start px-0 text-left whitespace-normal"
            onClick={() => onSelect(node.id)}
        >
            {node.kind === 'rule'
                ? `#${node.order} ${node.name}`
                : nodeTitle(node)}
        </Button>
        {suffix}
    </li>
)

const TypeBadge = ({ edge, type }: { edge?: GraphEdge; type: string }) => {
    const color = edge ? edgeStyle(edgeCategory(edge)).color : undefined
    return (
        <span
            className="mt-1.5 shrink-0 rounded-dhis2-sm border px-1 font-mono text-[10px] leading-4"
            style={{ color, borderColor: color }}
        >
            {type}
        </span>
    )
}

const NodeList = ({
    nodes,
    onSelect,
    suffix,
}: {
    nodes: GraphNode[]
    onSelect: (nodeId: string) => void
    suffix?: (node: GraphNode) => ReactNode
}) =>
    nodes.length === 0 ? (
        <Empty />
    ) : (
        <ul className="m-0 flex list-none flex-col p-0">
            {nodes.map((node) => (
                <NodeLink
                    key={node.id}
                    node={node}
                    onSelect={onSelect}
                    suffix={suffix?.(node)}
                />
            ))}
        </ul>
    )

const RuleList = ({
    model,
    onSelect,
}: {
    model: RulesGraphModel
    onSelect: (nodeId: string) => void
}) => (
    <Section title={i18n.t('Rules in evaluation order')}>
        <p className="m-0 text-sm text-dhis2-grey-700">
            {i18n.t(
                'Priority ascending, rules without a priority last. An assignment only feeds the rules after it. Select a node to follow its chain.'
            )}
        </p>
        <NodeList
            nodes={model.nodes.filter((node) => node.kind === 'rule')}
            onSelect={onSelect}
            suffix={(node) =>
                node.kind === 'rule' && node.priority !== undefined ? (
                    <span className="mt-1.5 text-xs text-dhis2-grey-600">
                        {i18n.t('P{{priority}}', { priority: node.priority })}
                    </span>
                ) : null
            }
        />
    </Section>
)

/** Selected node's details: a rule's condition and actions, or a node's readers and writers. */
export const NodeDetails = ({
    model,
    context,
    metadata,
    selectedId,
    onSelect,
}: NodeDetailsProps) => {
    const byId = new Map(model.nodes.map((node) => [node.id, node]))
    const node = selectedId === undefined ? undefined : byId.get(selectedId)
    if (node === undefined) {
        return <RuleList model={model} onSelect={onSelect} />
    }
    const incoming = model.edges.filter((edge) => edge.target === node.id)
    const outgoing = model.edges.filter((edge) => edge.source === node.id)
    const nodesOf = (edges: GraphEdge[], end: 'source' | 'target') =>
        edges.flatMap((edge) => {
            const found = byId.get(edge[end])
            return found === undefined ? [] : [found]
        })
    const edgeTo = (target: string) =>
        outgoing.find((edge) => edge.target === target)
    const edgeFrom = (source: string) =>
        incoming.find((edge) => edge.source === source)

    const header = (kindLabel: string, detail?: string) => (
        <header className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs tracking-wide text-dhis2-grey-600 uppercase">
                    {kindLabel}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelect(undefined)}
                >
                    {i18n.t('All rules')}
                </Button>
            </div>
            <h2 className="m-0 text-base leading-5 font-medium text-dhis2-grey-900">
                {nodeTitle(node)}
            </h2>
            {detail ? (
                <span className="font-mono text-xs text-dhis2-grey-600">
                    {detail}
                </span>
            ) : null}
        </header>
    )

    if (node.kind === 'rule') {
        const info = context.ruleInfo.get(node.ruleId)
        const dependencies = context.graph.rules.get(node.ruleId)
        const direct = new Set(
            incoming.flatMap((edge) => {
                const source = byId.get(edge.source)
                return source?.kind === 'field' ? [source.fieldId] : []
            })
        )
        const throughAssignments = (dependencies?.readsFields ?? []).flatMap(
            (fieldId) => {
                const found = byId.get(fieldNodeId(fieldId))
                return direct.has(fieldId) || found === undefined ? [] : [found]
            }
        )
        const targetOf = (fieldId?: string) =>
            fieldId === undefined ? undefined : byId.get(fieldNodeId(fieldId))
        return (
            <div
                className="flex flex-col gap-4"
                data-testid="rules-graph-details"
            >
                {header(
                    node.priority === undefined
                        ? i18n.t('Rule #{{order}}', { order: node.order })
                        : i18n.t('Rule #{{order}} · priority {{priority}}', {
                              order: node.order,
                              priority: node.priority,
                          }),
                    node.ruleId
                )}
                <Section title={i18n.t('Condition')}>
                    <Code>{info?.condition || 'true'}</Code>
                </Section>
                <Section title={i18n.t('Actions')}>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {ruleActions(context, node.ruleId).map((action) => {
                            const assigned = assignedVariable(action)
                            const target =
                                targetOf(
                                    action.dataElementId ?? action.attributeId
                                ) ??
                                (assigned === undefined
                                    ? undefined
                                    : model.nodes.find(
                                          (candidate) =>
                                              (candidate.kind === 'variable' &&
                                                  candidate.name ===
                                                      assigned) ||
                                              (candidate.kind === 'field' &&
                                                  candidate.variables.includes(
                                                      assigned
                                                  ))
                                      )) ??
                                byId.get(`section:${action.sectionId}`) ??
                                byId.get(`stage:${action.programStageId}`)
                            const text = action.displayContent ?? action.content
                            return (
                                <li
                                    key={action.id}
                                    className="flex flex-col gap-1 border-l-2 border-dhis2-grey-300 pl-2"
                                >
                                    <div className="flex flex-wrap items-start gap-2">
                                        <TypeBadge
                                            type={action.type}
                                            edge={target && edgeTo(target.id)}
                                        />
                                        {target ? (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto min-h-7 min-w-0 shrink px-0 text-left whitespace-normal"
                                                onClick={() =>
                                                    onSelect(target.id)
                                                }
                                            >
                                                {nodeTitle(target)}
                                            </Button>
                                        ) : null}
                                    </div>
                                    {text && !assigned ? (
                                        <p className="m-0 text-sm text-dhis2-grey-800">
                                            {text}
                                        </p>
                                    ) : null}
                                    {action.data ? (
                                        <Code>{action.data}</Code>
                                    ) : null}
                                </li>
                            )
                        })}
                    </ul>
                </Section>
                <Section title={i18n.t('Reads')}>
                    <NodeList
                        nodes={nodesOf(incoming, 'source')}
                        onSelect={onSelect}
                    />
                </Section>
                {throughAssignments.length > 0 ? (
                    <Section
                        title={i18n.t(
                            'Also depends on, through earlier assignments'
                        )}
                    >
                        <NodeList
                            nodes={throughAssignments}
                            onSelect={onSelect}
                        />
                    </Section>
                ) : null}
                {dependencies &&
                (dependencies.readsProgramVariables.length > 0 ||
                    dependencies.readsConstants.length > 0 ||
                    dependencies.readsOrgUnitGroups.length > 0) ? (
                    <Section title={i18n.t('Other inputs')}>
                        <Code>
                            {[
                                ...dependencies.readsProgramVariables.map(
                                    (name) => `V{${name}}`
                                ),
                                ...dependencies.readsConstants.map(
                                    (id) => `C{${id}}`
                                ),
                                ...dependencies.readsOrgUnitGroups.map(
                                    (group) => `d2:inOrgUnitGroup('${group}')`
                                ),
                            ].join('\n')}
                        </Code>
                    </Section>
                ) : null}
            </div>
        )
    }

    const readers = nodesOf(outgoing, 'target')
    const writers = nodesOf(incoming, 'source')
    const writerTypes = (writer: GraphNode) => {
        const edge = edgeFrom(writer.id)
        return edge ? (
            <span className="flex flex-wrap gap-1">
                {edge.actionTypes.map((type) => (
                    <TypeBadge key={type} type={type} edge={edge} />
                ))}
            </span>
        ) : null
    }
    const variable =
        node.kind === 'variable'
            ? metadata.variables.find(
                  (candidate) => candidate.name === node.name
              )
            : undefined

    const kindLabel =
        node.kind === 'field'
            ? i18n.t('Field')
            : node.kind === 'variable'
              ? i18n.t('Calculated variable')
              : node.kind === 'section'
                ? i18n.t('Section')
                : i18n.t('Program stage')
    const detail =
        node.kind === 'field'
            ? [
                  node.fieldId,
                  ...node.variables.map((name) => `#{${name}}`),
              ].join(' · ')
            : node.kind === 'variable'
              ? variable?.sourceType
              : node.targetId

    return (
        <div className="flex flex-col gap-4" data-testid="rules-graph-details">
            {header(kindLabel, detail)}
            {node.kind === 'section' || node.kind === 'stage' ? null : (
                <Section title={i18n.t('Read by')}>
                    <NodeList nodes={readers} onSelect={onSelect} />
                </Section>
            )}
            <Section
                title={
                    node.kind === 'variable'
                        ? i18n.t('Assigned by')
                        : i18n.t('Written by')
                }
            >
                <NodeList
                    nodes={writers}
                    onSelect={onSelect}
                    suffix={writerTypes}
                />
            </Section>
        </div>
    )
}

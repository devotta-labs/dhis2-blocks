import { cn } from '@dhis2-blocks/ui/cn'
import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    type Edge,
    type Node,
    type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import React, { useEffect, useMemo } from 'react'
import i18n from '../../i18n'
import { edgeStyle, edgeCategory } from './edgeStyles'
import {
    checkLoops,
    connectedChain,
    type GraphNode,
    type RulesGraphModel,
} from './graphModel'
import { layoutRulesGraph, NODE_SIZE } from './layout'

type FlowNodeData = { node: GraphNode; dimmed: boolean; selected: boolean }
type FlowNode = Node<FlowNodeData>

const hiddenHandle = '!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent'

const Handles = () => (
    <>
        <Handle
            type="target"
            position={Position.Left}
            isConnectable={false}
            className={hiddenHandle}
        />
        <Handle
            type="source"
            position={Position.Right}
            isConnectable={false}
            className={hiddenHandle}
        />
    </>
)

const shell = (data: FlowNodeData, className: string) =>
    cn(
        'flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden border bg-white px-3 text-left font-dhis2 transition-opacity',
        className,
        data.selected && 'outline-2 outline-offset-2 outline-dhis2-ring',
        data.dimmed && 'opacity-25'
    )

const shortType = (type: string) =>
    type.toLowerCase().replace(/^show|^display/, '')

const RuleNode = ({ data }: NodeProps<FlowNode>) => {
    const node = data.node
    if (node.kind !== 'rule') {
        return null
    }
    return (
        <div
            className={shell(
                data,
                'gap-1 rounded-dhis2-md border-dhis2-grey-500 shadow-dhis2-card'
            )}
            data-testid="rules-graph-rule"
        >
            <Handles />
            <div className="flex items-center gap-1.5 text-[11px] leading-none text-dhis2-grey-700">
                <span className="rounded-dhis2-sm bg-dhis2-grey-900 px-1 py-0.5 font-medium text-white">
                    #{node.order}
                </span>
                {node.priority !== undefined ? (
                    <span className="rounded-dhis2-sm bg-dhis2-grey-200 px-1 py-0.5">
                        {i18n.t('P{{priority}}', { priority: node.priority })}
                    </span>
                ) : null}
                <span className="ml-auto flex min-w-0 gap-1 overflow-hidden">
                    {node.effects.map((type) => (
                        <span
                            key={type}
                            className="truncate rounded-dhis2-sm bg-dhis2-blue-050 px-1 py-0.5 text-dhis2-blue-800"
                            title={type}
                        >
                            {shortType(type)}
                        </span>
                    ))}
                </span>
            </div>
            <div className="line-clamp-2 text-[13px] leading-4 font-medium text-dhis2-grey-900">
                {node.name}
            </div>
        </div>
    )
}

const FieldNode = ({ data }: NodeProps<FlowNode>) => {
    const node = data.node
    if (node.kind !== 'field') {
        return null
    }
    const subtitle =
        node.variables.length > 0
            ? node.variables.map((name) => `#{${name}}`).join(' ')
            : node.fieldId
    return (
        <div
            className={shell(
                data,
                'rounded-full border-dhis2-teal-300 bg-dhis2-teal-050 px-4'
            )}
            data-testid="rules-graph-field"
        >
            <Handles />
            <div
                className="truncate text-[13px] leading-4 text-dhis2-grey-900"
                title={node.label}
            >
                {node.label}
            </div>
            <div className="truncate font-mono text-[10px] leading-3 text-dhis2-grey-600">
                {subtitle}
            </div>
        </div>
    )
}

const TargetNode = ({ data }: NodeProps<FlowNode>) => {
    const node = data.node
    if (node.kind === 'rule' || node.kind === 'field') {
        return null
    }
    const [kindLabel, title] =
        node.kind === 'variable'
            ? [i18n.t('Calculated variable'), `#{${node.name}}`]
            : node.kind === 'section'
              ? [i18n.t('Section'), node.label]
              : [i18n.t('Program stage'), node.label]
    return (
        <div
            className={shell(
                data,
                cn(
                    'rounded-dhis2-md border-dashed',
                    node.kind === 'variable'
                        ? 'border-dhis2-blue-300 bg-dhis2-blue-050'
                        : 'border-dhis2-grey-500 bg-dhis2-grey-100'
                )
            )}
        >
            <Handles />
            <div className="text-[10px] leading-3 tracking-wide text-dhis2-grey-600 uppercase">
                {kindLabel}
            </div>
            <div
                className="truncate text-[13px] leading-4 text-dhis2-grey-900"
                title={title}
            >
                {title}
            </div>
        </div>
    )
}

const nodeTypes = {
    rule: RuleNode,
    field: FieldNode,
    variable: TargetNode,
    section: TargetNode,
    stage: TargetNode,
}

const FocusOnNode = ({
    nodeId,
    positions,
}: {
    nodeId?: string
    positions: Map<string, { x: number; y: number }>
}) => {
    const flow = useReactFlow()
    useEffect(() => {
        const position =
            nodeId === undefined ? undefined : positions.get(nodeId)
        if (position !== undefined) {
            void flow.setCenter(position.x, position.y, {
                zoom: Math.max(flow.getZoom(), 0.9),
                duration: 300,
            })
        }
    }, [flow, nodeId, positions])
    return null
}

interface RulesGraphCanvasProps {
    model: RulesGraphModel
    selectedId?: string
    /** Set when the selection came from outside the canvas, to bring it into view. */
    focusId?: string
    onSelect: (nodeId?: string) => void
}

/** Pan and zoom view of the rules graph; selecting a node highlights its chains. */
export const RulesGraphCanvas = ({
    model,
    selectedId,
    focusId,
    onSelect,
}: RulesGraphCanvasProps) => {
    const positions = useMemo(() => layoutRulesGraph(model), [model])
    const chain = useMemo(
        () =>
            selectedId === undefined
                ? undefined
                : connectedChain(model, selectedId),
        [model, selectedId]
    )

    const nodes = useMemo<FlowNode[]>(
        () =>
            model.nodes.map((node) => {
                const size = NODE_SIZE[node.kind]
                const centre = positions.get(node.id) ?? { x: 0, y: 0 }
                return {
                    id: node.id,
                    type: node.kind,
                    position: {
                        x: centre.x - size.width / 2,
                        y: centre.y - size.height / 2,
                    },
                    width: size.width,
                    height: size.height,
                    data: {
                        node,
                        selected: node.id === selectedId,
                        dimmed:
                            chain !== undefined && !chain.nodes.has(node.id),
                    },
                }
            }),
        [model, positions, chain, selectedId]
    )

    const edges = useMemo<Edge[]>(() => {
        const loops = checkLoops(model)
        const folded = new Set([...loops.values()].map((edge) => edge.id))
        return model.edges
            .filter((edge) => !folded.has(edge.id))
            .map((edge) => {
                // A check of the rule's own input: one line, arrows both ways,
                // in the colour of the message it shows.
                const loop = loops.get(edge.id)
                const style = edgeStyle(edgeCategory(loop ?? edge))
                const highlighted =
                    (chain?.edges.has(edge.id) ?? false) ||
                    (loop !== undefined && (chain?.edges.has(loop.id) ?? false))
                const dimmed = chain !== undefined && !highlighted
                const marker = {
                    type: MarkerType.ArrowClosed,
                    color: style.color,
                    width: 14,
                    height: 14,
                }
                const types = (loop ?? edge).actionTypes.join(', ')
                return {
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    label: !highlighted
                        ? undefined
                        : loop !== undefined
                          ? i18n.t('reads · {{types}}', { types })
                          : edge.kind === 'write'
                            ? types
                            : undefined,
                    labelStyle: { fontSize: 10, fill: style.color },
                    labelBgStyle: { fill: '#ffffff' },
                    labelBgPadding: [4, 2],
                    zIndex: highlighted ? 1 : 0,
                    style: {
                        stroke: style.color,
                        strokeWidth: highlighted ? 2.25 : 1.25,
                        strokeDasharray: style.dash,
                        opacity: dimmed ? 0.12 : 1,
                    },
                    markerStart: loop === undefined ? undefined : marker,
                    markerEnd: marker,
                } satisfies Edge
            })
    }, [model, chain])

    return (
        <ReactFlowProvider>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                fitView
                minZoom={0.1}
                maxZoom={2}
                onNodeClick={(_, node) =>
                    onSelect(node.id === selectedId ? undefined : node.id)
                }
                onPaneClick={() => onSelect(undefined)}
                aria-label={i18n.t('Program rules dependency graph')}
            >
                <Background gap={24} color="#e8edf2" />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable nodeStrokeWidth={2} />
                <FocusOnNode nodeId={focusId} positions={positions} />
            </ReactFlow>
        </ReactFlowProvider>
    )
}

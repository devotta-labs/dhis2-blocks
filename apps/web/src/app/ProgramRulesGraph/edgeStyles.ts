import i18n from '../../i18n'
import type { GraphEdge } from './graphModel'

export type EdgeCategory =
    | 'read'
    | 'assign'
    | 'visibility'
    | 'mandatory'
    | 'error'
    | 'warning'
    | 'other'

const ERROR_TYPES = new Set(['SHOWERROR', 'ERRORONCOMPLETE'])
const WARNING_TYPES = new Set(['SHOWWARNING', 'WARNINGONCOMPLETE'])

const actionCategory = (type: string): EdgeCategory => {
    if (type === 'ASSIGN') {
        return 'assign'
    }
    if (type.startsWith('HIDE') || type === 'SHOWOPTIONGROUP') {
        return 'visibility'
    }
    if (type === 'SETMANDATORYFIELD') {
        return 'mandatory'
    }
    if (ERROR_TYPES.has(type)) {
        return 'error'
    }
    return WARNING_TYPES.has(type) ? 'warning' : 'other'
}

// Value changes outrank visibility, visibility outranks messages.
const RANK: EdgeCategory[] = [
    'assign',
    'visibility',
    'mandatory',
    'error',
    'warning',
    'other',
]

export const edgeCategory = (edge: GraphEdge): EdgeCategory => {
    if (edge.kind === 'read') {
        return 'read'
    }
    const categories = edge.actionTypes.map(actionCategory)
    return RANK.find((category) => categories.includes(category)) ?? 'other'
}

interface EdgeStyle {
    color: string
    /** SVG dash array; solid when absent. */
    dash?: string
    label: () => string
}

/**
 * SVG strokes for each category. Hex, not CSS variables, because React Flow
 * builds marker ids from the colour. Values are the dhis2 theme tokens.
 */
const EDGE_STYLE = {
    read: { color: '#a0adba', label: () => i18n.t('Reads') }, // grey-500
    assign: { color: '#147cd7', label: () => i18n.t('Assigns') }, // blue-600
    visibility: {
        color: '#4a5768', // grey-700
        dash: '6 4',
        label: () => i18n.t('Hides or shows'),
    },
    mandatory: { color: '#00796b', label: () => i18n.t('Makes mandatory') }, // teal-600
    error: { color: '#d32f2f', label: () => i18n.t('Shows an error') }, // red-500
    warning: { color: '#e56408', label: () => i18n.t('Shows a warning') }, // yellow-700
    other: { color: '#6c7787', label: () => i18n.t('Other action') }, // grey-600
} satisfies Record<EdgeCategory, EdgeStyle>

export const edgeStyle = (category: EdgeCategory): EdgeStyle =>
    EDGE_STYLE[category]

import {
    isMarkedForFollowUp,
    type DateOf,
    type RelationshipNode,
    type RelationshipStatus,
} from '@/components/relationship-viewer'
import { ATTRIBUTES, RELATIONSHIP_TYPES } from './labData'
import type { LabView } from './presets'

/** The status, date and label rules a contact-tracing host would write, picked by the lab's controls. */
const DAY_MS = 86_400_000

const attributeOf = (node: RelationshipNode, attribute: string) =>
    node.state.status === 'loaded'
        ? node.state.record.attributes.find((a) => a.attribute === attribute)
              ?.value
        : undefined

/** The statuses a contact-tracing host would declare, with the attention status the chosen rule names. */
export const statusesFor = (
    rule: LabView['attentionRule']
): RelationshipStatus[] => [
    ...(rule === 'none'
        ? []
        : [
              {
                  key: 'attention',
                  label:
                      rule === 'overdue'
                          ? 'Follow-up overdue'
                          : 'Marked for follow-up',
                  color: 'var(--color-dhis2-yellow-600)',
                  attention: true,
              },
          ]),
    {
        key: 'confirmed',
        label: 'Confirmed case',
        color: 'var(--color-dhis2-red-600)',
        size: 'large',
    },
    {
        key: 'probable',
        label: 'Probable case',
        color: 'var(--color-dhis2-red-300)',
        size: 'large',
    },
    { key: 'contact', label: 'Contact', color: 'var(--color-dhis2-blue-600)' },
    {
        key: 'completed',
        label: 'Follow-up completed',
        color: 'var(--color-dhis2-green-600)',
    },
    {
        key: 'labResult',
        label: 'Lab result',
        color: 'var(--color-dhis2-teal-600)',
    },
]

export const statusRule =
    ({ attentionRule, overdueDays }: LabView, program: string) =>
    (node: RelationshipNode): string => {
        if (node.ref.kind === 'event') return 'labResult'
        const classification = attributeOf(node, ATTRIBUTES.classification)
        if (classification === 'Confirmed') return 'confirmed'
        if (classification === 'Probable') return 'probable'
        // Live programs without a classification: the records you start from are the cases.
        if (classification === undefined && node.seed) return 'confirmed'
        if (
            attentionRule === 'followUp' &&
            isMarkedForFollowUp(node, program)
        ) {
            return 'attention'
        }
        const lastSeen = attributeOf(node, ATTRIBUTES.lastFollowUp)
        if (
            attentionRule === 'overdue' &&
            lastSeen &&
            Date.now() - new Date(lastSeen).getTime() > overdueDays * DAY_MS
        ) {
            return 'attention'
        }
        const enrollment =
            node.state.status === 'loaded'
                ? node.state.record.enrollments[0]
                : undefined
        return enrollment?.status === 'COMPLETED' ? 'completed' : 'contact'
    }

export const dateRule = (rule: LabView['dateRule']): DateOf | undefined => {
    if (rule === 'none') return () => undefined
    if (rule === 'onset') {
        return (node) => {
            const at =
                node.state.status === 'loaded'
                    ? node.state.record.enrollments[0]?.occurredAt
                    : undefined
            return at ? new Date(at) : undefined
        }
    }
    // The block's default: enrollment date, or an event's occurred date.
    return undefined
}

export const labelRule = (rule: LabView['label']) => {
    if (rule === 'uid') return (node: RelationshipNode) => node.ref.id
    if (rule === 'village') {
        return (node: RelationshipNode, defaultLabel: string) => {
            const village = attributeOf(node, ATTRIBUTES.village)
            return village ? `${defaultLabel}, ${village}` : defaultLabel
        }
    }
    return undefined
}

const FOLLOWABLE = ['contact', 'household', 'labResult'] as const

/** Every type followed is the block's default, so the prop is left out. */
export const followTypes = ({ follow }: LabView) => {
    const followed = FOLLOWABLE.filter((type) => follow[type]).map(
        (type) => RELATIONSHIP_TYPES[type].id
    )
    return followed.length === FOLLOWABLE.length ? undefined : followed
}

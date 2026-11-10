import { formatDhis2Value } from '@/components/dhis2-value-display'
import type {
    AttributeMeta,
    LinkedEnd,
    RelationshipEnd,
    RelationshipRecord,
    RelationshipTypeMeta,
} from '../../api/types'
import type { HeaderContextValue } from '../../provider/context'

type DisplayOptions = HeaderContextValue['display']

export type RelationshipLabel = string | { from: string; to: string }
export type ResolvedLink = { id: string; name: string } | { restricted: true }

export interface RelationshipGroup {
    /** `${type}` for a bidirectional type, else `${type}:${end}`. */
    key: string
    type: string
    end: RelationshipEnd | 'both'
    label: string
    kind: 'records' | 'events' | 'enrollments'
    count: number
    links: ResolvedLink[]
}

export const labelFor = (
    meta: RelationshipTypeMeta | undefined,
    end: RelationshipEnd | 'both',
    fallback: string,
    override?: RelationshipLabel
): string => {
    if (override instanceof Object) {
        return end === 'to' ? override.to : override.from
    }
    if (override !== undefined) {
        return override
    }
    const named = end === 'to' ? meta?.toFromName : meta?.fromToName
    return named ?? meta?.name ?? fallback
}

const KINDS = { event: 'events', enrollment: 'enrollments' } as const

const linkName = (
    other: Extract<LinkedEnd, { kind: 'trackedEntity' }>,
    meta: RelationshipTypeMeta | undefined,
    otherEnd: RelationshipEnd,
    attributes: Map<string, AttributeMeta>,
    display: DisplayOptions
): string => {
    const end = meta?.ends[otherEnd]
    // Without the type's metadata the values still come back, in the order they arrived.
    const uids = end ? end.view : [...other.values.keys()]
    const parts = uids.flatMap((uid) => {
        const raw = other.values.get(uid)
        if (raw === undefined || raw === '') {
            return []
        }
        const attribute = attributes.get(uid)
        return attribute
            ? formatDhis2Value(
                  raw,
                  {
                      valueType: attribute.valueType,
                      optionSet: attribute.optionSet,
                  },
                  display
              )
            : raw
    })
    return parts.length
        ? parts.join(' ')
        : (end?.typeName ?? meta?.name ?? other.id)
}

export const resolveRelationships = ({
    records,
    types,
    attributes,
    display,
    labels,
}: {
    records: RelationshipRecord[]
    types: Map<string, RelationshipTypeMeta>
    attributes: Map<string, AttributeMeta>
    display: DisplayOptions
    labels?: Readonly<Record<string, RelationshipLabel>>
}): RelationshipGroup[] => {
    const groups = new Map<string, RelationshipGroup>()
    for (const record of records) {
        const meta = types.get(record.type)
        const end = meta?.bidirectional ? 'both' : record.end
        const key = end === 'both' ? record.type : `${record.type}:${end}`
        const { other } = record
        let group = groups.get(key)
        if (!group) {
            group = {
                key,
                type: record.type,
                end,
                label: labelFor(
                    meta,
                    end,
                    record.name ?? record.type,
                    labels?.[record.type]
                ),
                kind:
                    (other.kind !== 'trackedEntity' &&
                        other.kind !== 'unreadable' &&
                        KINDS[other.kind]) ||
                    'records',
                count: 0,
                links: [],
            }
            groups.set(key, group)
        }
        group.count += 1
        if (other.kind === 'unreadable') {
            group.links.push({ restricted: true })
        } else if (other.kind === 'trackedEntity') {
            group.links.push({
                id: other.id,
                name: linkName(
                    other,
                    meta,
                    record.end === 'from' ? 'to' : 'from',
                    attributes,
                    display
                ),
            })
        }
    }
    return [...groups.values()]
}

import i18n from '@dhis2/d2-i18n'
import { httpStatusOf } from './client'
import type { ChangeLogRow, TrackerUser } from './schemas'
import type { ChangeSave, FieldInfo, ResolvedChange } from './types'

/** Looks up a changed field's label and value metadata. */
export type ResolveField = (
    field: ResolvedChange['field']
) => FieldInfo | undefined

const displayNameOf = ({ username, firstName, surname }: TrackerUser) =>
    [firstName, surname].filter(Boolean).join(' ') || username

/**
 * Labels for the event fields that 2.42+ record in an event's changelog.
 * @public For hosts labelling changes they fetch themselves.
 */
export const eventFieldInfo = (id: string): FieldInfo | undefined => {
    switch (id) {
        case 'occurredAt':
            return { name: i18n.t('Event date'), meta: { valueType: 'DATE' } }
        case 'scheduledAt':
            return { name: i18n.t('Due date'), meta: { valueType: 'DATE' } }
        case 'completedAt':
            return {
                name: i18n.t('Completed date'),
                meta: { valueType: 'DATE' },
            }
        case 'geometry':
            return {
                name: i18n.t('Coordinates'),
                meta: { valueType: 'COORDINATE' },
            }
        default:
            return undefined
    }
}

const toChange = (
    { type, change }: ChangeLogRow,
    resolve: ResolveField
): ResolvedChange => {
    const field = { kind: change.kind, id: change.id }
    const info =
        (field.kind === 'eventField' ? eventFieldInfo(field.id) : undefined) ??
        resolve(field)
    const row: ResolvedChange = {
        field,
        name: info?.name ?? field.id,
        meta: info?.meta ?? { valueType: 'TEXT' },
        type,
    }
    if (change.previousValue !== undefined) {
        row.previousValue = change.previousValue
    }
    if (change.currentValue !== undefined) {
        row.currentValue = change.currentValue
    }
    return row
}

/**
 * Groups changelog rows into saves, newest first, with each field's label
 * resolved. Rows of one save need not be adjacent. A row repeated for the same
 * `createdAt`, user and field (the type's attributes come back in every
 * program's changelog) is kept once; the same field changed in another save
 * is a separate row.
 */
export const groupChangelogRows = (
    rows: ReadonlyArray<ChangeLogRow>,
    resolve: ResolveField = () => undefined
): ChangeSave[] => {
    const saves = new Map<string, ChangeSave>()
    const seen = new Set<string>()
    const newestFirst = [...rows].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    )
    for (const row of newestFirst) {
        const { username } = row.createdBy
        const id = `${row.createdAt}:${username}`
        const rowKey = `${id}:${row.change.kind}:${row.change.id}`
        if (seen.has(rowKey)) {
            continue
        }
        seen.add(rowKey)
        let save = saves.get(id)
        if (save === undefined) {
            save = {
                id,
                createdAt: row.createdAt,
                user: { username, displayName: displayNameOf(row.createdBy) },
                changes: [],
            }
            saves.set(id, save)
        }
        save.changes.push(toChange(row, resolve))
    }
    return [...saves.values()]
}

export const isNotFound = (error: Error) => httpStatusOf(error) === 404

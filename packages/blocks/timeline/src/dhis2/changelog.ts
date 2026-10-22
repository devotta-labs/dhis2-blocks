import i18n from '@dhis2/d2-i18n'
import type { SourceError } from '../core/types'
import { httpStatusOf } from './client'
import type { ChangeLogRow, TrackerUser } from './schemas'

export interface ChangeRow {
    field: { kind: 'dataElement' | 'attribute' | 'eventField'; id: string }
    type: 'CREATE' | 'UPDATE' | 'DELETE'
    previousValue?: string
    currentValue?: string
}

/** The rows one user saved together: same `createdAt`, same user. */
export interface ChangeGroup {
    /** `${createdAt}:${username}` */
    id: string
    createdAt: string
    user: { username: string; displayName: string }
    changes: ChangeRow[]
}

const displayNameOf = ({ username, firstName, surname }: TrackerUser) =>
    [firstName, surname].filter(Boolean).join(' ') || username

const toChange = ({ type, change }: ChangeLogRow): ChangeRow => {
    const row: ChangeRow = { field: { kind: change.kind, id: change.id }, type }
    if (change.previousValue !== undefined) {
        row.previousValue = change.previousValue
    }
    if (change.currentValue !== undefined) {
        row.currentValue = change.currentValue
    }
    return row
}

/**
 * Groups changelog rows (newest first) into saves, newest first. Rows of one
 * save need not be adjacent. A row repeated for the same `createdAt` and field
 * (an offset page that shifted) is kept once; the same field changed in
 * another save is a separate row.
 */
export const groupChangelogRows = (rows: ChangeLogRow[]): ChangeGroup[] => {
    const groups = new Map<string, ChangeGroup>()
    const seen = new Set<string>()
    for (const row of rows) {
        const { username } = row.createdBy
        const id = `${row.createdAt}:${username}`
        const rowKey = `${id}:${row.change.kind}:${row.change.id}`
        if (seen.has(rowKey)) {
            continue
        }
        seen.add(rowKey)
        let group = groups.get(id)
        if (group === undefined) {
            group = {
                id,
                createdAt: row.createdAt,
                user: { username, displayName: displayNameOf(row.createdBy) },
                changes: [],
            }
            groups.set(id, group)
        }
        group.changes.push(toChange(row))
    }
    // Map order is first appearance, which is newest first for server rows.
    return [...groups.values()]
}

export interface TrailingSaveSplit {
    emitted: ChangeLogRow[]
    carry: ChangeLogRow[]
}

/**
 * Splits a full page (newest first) into the rows that are safe to show and
 * every row at its oldest `createdAt`, which may continue on the next page.
 * All users at that instant are held back, not only the last row's, so
 * "everything at or after the last shown save" stays true.
 */
export const splitTrailingSave = (rows: ChangeLogRow[]): TrailingSaveSplit => {
    const oldest = rows.reduce<string | undefined>(
        (min, row) =>
            min === undefined || row.createdAt < min ? row.createdAt : min,
        undefined
    )
    return {
        emitted: rows.filter((row) => row.createdAt !== oldest),
        carry: rows.filter((row) => row.createdAt === oldest),
    }
}

export const isNotFound = (error: Error) => httpStatusOf(error) === 404

/** A 404 from a changelog endpoint is `unsupported`; anything else `failed`. */
export const changelogError = (cause: unknown): SourceError => {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    return isNotFound(error)
        ? {
              kind: 'unsupported',
              message: i18n.t(
                  "Changes aren't available on this DHIS2 version."
              ),
          }
        : { kind: 'failed', error }
}

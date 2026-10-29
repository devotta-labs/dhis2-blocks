import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { useStore } from 'zustand'
import { useDataEntryContext } from '../../provider/context'
import type { DataEngine } from '../../sources/types'
import type { PopupEditorProps } from '../popupEditors'
import { SearchEditor } from './SearchEditor'

const searchSchema = z.object({
    orgUnits: z.object({
        pager: z.object({ total: z.number() }),
        organisationUnits: z.array(
            z.object({
                id: z.string(),
                displayName: z.string(),
                ancestors: z.array(z.object({ displayName: z.string() })),
            })
        ),
    }),
})

/** The org units within the user's search scope matching the query, each with its path as names, in one request. */
const searchOrgUnits = async (
    engine: DataEngine,
    query: string,
    signal: AbortSignal
) => {
    const { orgUnits } = searchSchema.parse(
        await engine.query(
            {
                orgUnits: {
                    resource: 'organisationUnits',
                    params: {
                        query,
                        withinUserSearchHierarchy: true,
                        // Ancestors come from the top of the hierarchy down.
                        fields: 'id,displayName,ancestors[displayName]',
                    },
                },
            },
            { signal }
        )
    )
    return {
        total: orgUnits.pager.total,
        results: orgUnits.organisationUnits.map(
            ({ id, displayName, ancestors }) => ({
                value: id,
                name: displayName,
                detail: ancestors.map((each) => each.displayName).join(' / '),
            })
        ),
    }
}

/**
 * An org unit, searched within the user's search scope by name, code or id; each result shows its path. A pick saves
 * its id, and its name joins the form's names, so the cell shows it.
 */
export const OrgUnitEditor = (props: PopupEditorProps) => {
    const { orgUnitNames } = useDataEntryContext()
    const { value } = props
    const name = useStore(orgUnitNames, ({ names }) =>
        value === undefined ? undefined : names.get(value)
    )
    return (
        <SearchEditor
            {...props}
            shown={name ?? value ?? ''}
            label={i18n.t('Search organisation units')}
            none={i18n.t('No organisation units found')}
            search={searchOrgUnits}
            onPick={(picked) =>
                orgUnitNames.setState(({ names }) => ({
                    names: new Map(names).set(picked.value, picked.name),
                }))
            }
        />
    )
}

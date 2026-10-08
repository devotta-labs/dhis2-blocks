import { renderHook } from 'vitest-browser-react'
import { resolveWorkingListCapabilities } from '../api/capabilities'
import type { ProgramFieldCatalog } from '../api/metadata'
import {
    createDefaultWorkingList,
    defaultWorkingListId,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import { toPublicConfiguration } from './configuration'
import { useWorkingListSelection } from './useWorkingListSelection'

const textField = {
    id: 'Attribute01',
    displayName: 'Name',
    source: 'trackedEntityAttribute' as const,
    scope: 'trackedEntity' as const,
    valueType: 'TEXT' as const,
    filterable: true,
}

const metadata: ProgramFieldCatalog = {
    fields: new Map([[textField.id, textField]]),
    fieldsByProgramStage: new Map(),
    capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
    defaultTrackedEntityColumns: [textField.id],
    defaultEventColumnsByStage: new Map(),
    readableProgramStageIds: new Set(),
}

const defaultListId = defaultWorkingListId('Program0001')

const defaultList = createDefaultWorkingList({
    programId: 'Program0001',
    columns: [textField.id],
})

const savedList = (id: string, columns: string[]) => ({
    ...createDefaultWorkingList({ programId: 'Program0001', columns }),
    id,
    name: id,
})

const listA = savedList('SavedList01', [textField.id])

const listB = savedList('SavedList02', [textField.id])

const editedA = {
    savedListId: listA.id,
    configuration: {
        ...toPublicConfiguration(listA.configuration),
        columns: [],
    },
    resolved: { ...listA.configuration, columns: [] },
}

interface Props {
    selectedSavedListId: string
    lists?: NormalizedSavedWorkingList[]
}

const renderSelection = async (initialProps: Props) => {
    const onSelectedSavedListChange = vi.fn()

    const rendered = await renderHook(
        (props?: Props) =>
            useWorkingListSelection({
                selectedSavedListId:
                    props?.selectedSavedListId ??
                    initialProps.selectedSavedListId,
                onSelectedSavedListChange,
                defaultList,
                confirmedLists: props?.lists,
                defaultListId,
                metadata,
                displayedLists: props?.lists ?? [],
            }),
        { initialProps }
    )

    return { ...rendered, onSelectedSavedListChange }
}

describe('useWorkingListSelection', () => {
    it('resolves the requested list once server lists arrive', async () => {
        const { result, rerender } = await renderSelection({
            selectedSavedListId: listA.id,
        })

        expect(result.current.selection).toEqual({
            status: 'pending',
            requestedSavedListId: listA.id,
        })
        expect(result.current.activeState).toBeUndefined()

        await rerender({ selectedSavedListId: listA.id, lists: [listA] })

        expect(result.current.selection).toEqual({
            status: 'ready',
            selectedSavedListId: listA.id,
        })
        expect(result.current.activeState).toEqual({
            selectedSavedListId: listA.id,
            configuration: toPublicConfiguration(listA.configuration),
        })
        expect(result.current.resolvedConfiguration).toBe(listA.configuration)
        expect(result.current.dirty).toBe(false)
    })

    it('applies a draft over the baseline and reports it as dirty', async () => {
        const { result, act } = await renderSelection({
            selectedSavedListId: listA.id,
            lists: [listA],
        })

        await act(() => result.current.setDraft(editedA))

        expect(result.current.activeState?.configuration).toBe(
            editedA.configuration
        )
        expect(result.current.resolvedConfiguration).toBe(editedA.resolved)
        expect(result.current.dirty).toBe(true)
    })

    it('discards the draft when the host navigates away and back', async () => {
        const { result, rerender, act } = await renderSelection({
            selectedSavedListId: listA.id,
            lists: [listA, listB],
        })

        await act(() => result.current.setDraft(editedA))
        await rerender({ selectedSavedListId: listB.id, lists: [listA, listB] })

        expect(result.current.activeState?.selectedSavedListId).toBe(listB.id)
        expect(result.current.dirty).toBe(false)

        await rerender({ selectedSavedListId: listA.id, lists: [listA, listB] })

        expect(result.current.activeState?.configuration).toEqual(
            toPublicConfiguration(listA.configuration)
        )
        expect(result.current.dirty).toBe(false)
    })

    it('settles dirty state against a refreshed baseline', async () => {
        const { result, rerender, act } = await renderSelection({
            selectedSavedListId: listA.id,
            lists: [listA],
        })

        await act(() => result.current.setDraft(editedA))
        expect(result.current.dirty).toBe(true)

        const savedA = { ...listA, configuration: editedA.resolved }
        await rerender({ selectedSavedListId: listA.id, lists: [savedA] })

        expect(result.current.dirty).toBe(false)
    })

    it('reports a selected list removed by a refresh and drops its draft', async () => {
        const { result, rerender, act } = await renderSelection({
            selectedSavedListId: listA.id,
            lists: [listA],
        })

        await act(() => result.current.setDraft(editedA))
        await rerender({ selectedSavedListId: listA.id, lists: [listB] })

        expect(result.current.selection).toMatchObject({
            status: 'error',
            requestedSavedListId: listA.id,
        })
        expect(result.current.activeState).toBeUndefined()

        await rerender({ selectedSavedListId: listA.id, lists: [listA] })

        expect(result.current.dirty).toBe(false)
    })

    it('shows a local selection until the host acknowledges it', async () => {
        const { result, rerender, act, onSelectedSavedListChange } =
            await renderSelection({
                selectedSavedListId: listA.id,
                lists: [listA, listB],
            })

        await act(() => result.current.selectSavedList(listB.id))

        expect(onSelectedSavedListChange).toHaveBeenCalledWith(listB.id)
        expect(result.current.requestedId).toBe(listB.id)

        await rerender({ selectedSavedListId: listB.id, lists: [listA, listB] })
        expect(result.current.requestedId).toBe(listB.id)

        await rerender({ selectedSavedListId: listA.id, lists: [listA, listB] })
        expect(result.current.requestedId).toBe(listA.id)
    })
})

import type { WorkingListConfiguration } from '../domain/model'
import { createWorkingListStore } from './workingListStore'

const configuration: WorkingListConfiguration = {
    mode: 'trackedEntity',
    programId: 'Program0001',
    filters: [],
    columns: ['createdAt'],
    sort: { fieldId: 'createdAt', direction: 'desc' },
}

describe('scoped working-list store', () => {
    it('tracks an applied configuration baseline without table state', () => {
        const store = createWorkingListStore(configuration, {
            id: 'active',
            resource: 'generatedDefault',
        })

        expect(store.getState()).toMatchObject({
            criteria: {
                mode: 'trackedEntity',
                programId: 'Program0001',
                filters: [],
            },
            dirty: false,
        })
        expect(store.getState()).not.toHaveProperty('pagination')
        expect(store.getState()).not.toHaveProperty('columnSizing')
        expect(store.getState()).not.toHaveProperty('sorting')
    })

    it('marks edits dirty and clears dirty after accepting a configuration', () => {
        const store = createWorkingListStore(configuration)

        store.getState().markDirty()
        expect(store.getState().dirty).toBe(true)
        store.getState().acceptConfiguration(configuration)
        expect(store.getState().dirty).toBe(false)
    })

    it('reconciles column visibility/order and sort against the baseline', () => {
        const store = createWorkingListStore(configuration)

        store.getState().reconcileView({
            columns: ['createdAt'],
            sort: { fieldId: 'createdAt', direction: 'asc' },
        })
        expect(store.getState().dirty).toBe(true)
        store.getState().reconcileView({
            columns: ['createdAt'],
            sort: { fieldId: 'createdAt', direction: 'desc' },
        })
        expect(store.getState().dirty).toBe(false)
    })

    it('deselects the saved list and resets cleanly to a default configuration', () => {
        const store = createWorkingListStore(configuration, {
            id: 'active',
            resource: 'generatedDefault',
        })

        store.getState().setFilters([
            {
                field: {
                    id: 'Attribute01',
                    displayName: 'Name',
                    source: 'trackedEntityAttribute',
                    scope: 'trackedEntity',
                    valueType: 'TEXT',
                    filterable: true,
                },
                operator: 'like',
                value: { kind: 'text', value: 'A' },
            },
        ])
        expect(store.getState().dirty).toBe(true)

        store.getState().clearSelection(configuration)
        expect(store.getState()).toMatchObject({
            criteria: {
                mode: 'trackedEntity',
                programId: 'Program0001',
                filters: [],
            },
            selectedList: undefined,
            dirty: false,
        })
    })

    it('morphs modes while retaining only tracked-entity filters', () => {
        const store = createWorkingListStore({
            ...configuration,
            filters: [
                {
                    field: {
                        id: 'Attribute01',
                        displayName: 'Name',
                        source: 'trackedEntityAttribute',
                        scope: 'trackedEntity',
                        valueType: 'TEXT',
                        filterable: true,
                    },
                    operator: 'like',
                    value: { kind: 'text', value: 'A' },
                },
            ],
        })

        store.getState().enterEventMode('ProgramStg1')
        expect(store.getState().criteria).toMatchObject({
            mode: 'event',
            programStageId: 'ProgramStg1',
            filters: [{ field: { id: 'Attribute01' } }],
        })
        store.getState().leaveEventMode()
        expect(store.getState().criteria).toMatchObject({
            mode: 'trackedEntity',
            filters: [{ field: { id: 'Attribute01' } }],
        })
    })
})

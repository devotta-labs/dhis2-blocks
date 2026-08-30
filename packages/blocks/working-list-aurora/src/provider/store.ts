import { createStore, type StoreApi } from 'zustand/vanilla'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import type { WorkingListMeta, WorkingListState } from './contracts'

export interface WorkingListProviderStoreState {
    activeState?: WorkingListState
    resolvedConfiguration?: InternalConfiguration
    baselineFingerprint?: string
    meta: WorkingListMeta
}

export type WorkingListProviderStore = StoreApi<WorkingListProviderStoreState>

export const createWorkingListProviderStore = (
    initialMeta: WorkingListMeta
): WorkingListProviderStore =>
    createStore<WorkingListProviderStoreState>(() => ({ meta: initialMeta }))

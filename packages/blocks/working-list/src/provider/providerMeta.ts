import type { NormalizedSavedWorkingList } from '../api/savedLists'
import type {
    WorkingListMeta,
    WorkingListMutationStatus,
    WorkingListPagination,
    WorkingListSavedView,
} from './contracts'
import { WORKING_LIST_PAGE_SIZES } from './contracts'

export const assertPagination = (pagination: WorkingListPagination) => {
    if (!Number.isInteger(pagination.page) || pagination.page < 1) {
        throw new Error(
            `WorkingList requires pagination.page to be a positive integer; received ${String(pagination.page)}`
        )
    }

    if (!WORKING_LIST_PAGE_SIZES.includes(pagination.pageSize)) {
        throw new Error(
            `WorkingList requires pagination.pageSize to be one of ${WORKING_LIST_PAGE_SIZES.join(', ')}; received ${String(pagination.pageSize)}`
        )
    }
}

const idleMutation = (): WorkingListMutationStatus => ({ status: 'idle' })

export const initialMeta = (
    pagination: WorkingListPagination
): WorkingListMeta => ({
    lifecycle: { status: 'pending' },
    selection: { status: 'pending' },
    activeConfiguration: { status: 'unavailable' },
    savedViews: { status: 'pending', views: [] },
    mutations: {
        create: idleMutation(),
        update: idleMutation(),
        delete: idleMutation(),
    },
    results: { status: 'pending' },
    dirty: false,
    online: true,
    pagination,
    fields: [],
})

export const asSavedView = (
    list: NormalizedSavedWorkingList,
    generated: boolean
): WorkingListSavedView => ({
    id: list.id,
    name: list.name,
    generated,
    compatible: list.compatibility === 'compatible',
    canUpdate:
        !generated &&
        list.sharing.access?.write === true &&
        list.sharing.access.update === true,
    canDelete: !generated && list.sharing.access?.delete === true,
    canShare: !generated && list.sharing.access?.manage === true,
})

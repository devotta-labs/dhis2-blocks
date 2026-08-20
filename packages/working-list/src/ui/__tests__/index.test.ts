import {
    WorkingList,
    WorkingListQueryBoundary,
    WorkingListTextProvider,
    createWorkingListQueryClient,
} from '../index'

jest.mock('../WorkingList', () => ({ WorkingList: () => null }))

describe('working-list package UI surface', () => {
    it('exports the self-contained component and translation provider', () => {
        expect(typeof WorkingList).toBe('function')
        expect(typeof WorkingListQueryBoundary).toBe('function')
        expect(typeof WorkingListTextProvider).toBe('function')
        expect(typeof createWorkingListQueryClient).toBe('function')
    })
})

import type { WorkingListCriteria } from '../../domain/model'
import { visibleEventFiltersAfterStageChange } from './WorkingListFilterBar'

const criteria: WorkingListCriteria = {
    mode: 'event',
    programId: 'Program0001',
    programStageId: 'Stage000001',
    filters: [],
}

describe('visibleEventFiltersAfterStageChange', () => {
    it('clears controls left over from the previous stage', () => {
        expect(
            visibleEventFiltersAfterStageChange({
                criteria,
                stageId: 'Stage000002',
                visibleFilterIds: ['eventOccurredAt'],
            })
        ).toEqual([])
    })

    it('keeps the newly selected filter while entering its stage', () => {
        expect(
            visibleEventFiltersAfterStageChange({
                criteria,
                stageId: 'Stage000002',
                visibleFilterIds: ['eventOccurredAt'],
                addedFilterId: 'eventStatus',
            })
        ).toEqual(['eventStatus'])
    })

    it('preserves controls when re-entering the current stage', () => {
        expect(
            visibleEventFiltersAfterStageChange({
                criteria,
                stageId: 'Stage000001',
                visibleFilterIds: ['eventOccurredAt'],
            })
        ).toEqual(['eventOccurredAt'])
    })
})

import type { WorkingListConfiguration } from '../provider/contracts'
import { visibleEventFiltersAfterStageChange } from './visibleEventFilters'

const configuration: WorkingListConfiguration = {
    mode: 'event',
    programStageId: 'Stage000001',
    filters: [],
    columns: ['createdAt'],
    sort: { fieldId: 'createdAt', direction: 'desc' },
}

describe('visibleEventFiltersAfterStageChange', () => {
    it('clears controls left over from the previous stage', () => {
        expect(
            visibleEventFiltersAfterStageChange({
                configuration,
                stageId: 'Stage000002',
                visibleFilterIds: ['eventOccurredAt'],
            })
        ).toEqual([])
    })

    it('keeps the newly selected filter while entering its stage', () => {
        expect(
            visibleEventFiltersAfterStageChange({
                configuration,
                stageId: 'Stage000002',
                visibleFilterIds: ['eventOccurredAt'],
                addedFilterId: 'eventStatus',
            })
        ).toEqual(['eventStatus'])
    })

    it('preserves controls when re-entering the current stage', () => {
        expect(
            visibleEventFiltersAfterStageChange({
                configuration,
                stageId: 'Stage000001',
                visibleFilterIds: ['eventOccurredAt'],
            })
        ).toEqual(['eventOccurredAt'])
    })
})

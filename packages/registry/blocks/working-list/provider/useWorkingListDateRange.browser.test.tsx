import { useWorkingListDateRange } from './useWorkingListDateRange'
import { setup } from './__tests__/providerTestSupport'

it('reports an event date on a tracked-entity list as an error without issuing a date-window request', async () => {
    const Probe = () => {
        const results = useWorkingListDateRange({
            fieldId: 'eventScheduledAt',
            start: '2026-11-01',
            end: '2026-11-30',
        })
        return <output aria-label="Date range">{results.status}</output>
    }
    const h = await setup('SavedList01', false, <Probe />)
    await h.settle()
    await expect
        .element(h.screen.getByRole('status', { name: 'Date range' }))
        .toHaveTextContent('error')
    expect(h.requests('tracker/events')).toBe(0)
    expect(h.requests('tracker/trackedEntities')).toBe(1)
    expect(
        h.query.mock.calls.find(
            ([query]) =>
                query.workingListResource.resource === 'tracker/trackedEntities'
        )?.[0].workingListResource.params
    ).not.toHaveProperty('scheduledAfter')
    await h.dispose()
})

import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { TrackedEntityAttributeField } from '../../types'
import { useTrackedEntityChangelog } from '../useTrackedEntityChangelog'

const field = (
    id: string,
    label: string,
    origin: TrackedEntityAttributeField['origin']
): TrackedEntityAttributeField => ({
    id,
    label,
    origin,
    valueType: 'TEXT',
    rawValue: null,
    value: { kind: 'empty' },
    displayInList: true,
    unique: false,
})

const attributes = [
    field('AttrFirst01', 'First name', 'both'),
    field('AttrNation1', 'Nationality', 'trackedEntityType'),
]

class Boundary extends React.Component<
    { children: React.ReactNode },
    { message: string | null }
> {
    state = { message: null }

    static getDerivedStateFromError(error: Error) {
        return { message: error.message }
    }

    render() {
        return this.state.message === null ? (
            this.props.children
        ) : (
            <p data-testid="crash">{this.state.message}</p>
        )
    }
}

/** Builds `attributes` inline, a fresh array on every render. */
function InlineAttributesProbe() {
    const { data, error } = useTrackedEntityChangelog({
        trackedEntityId: 'TrackedEnt1',
        attributes: attributes.filter(
            (attribute) => attribute.origin !== 'trackedEntityType'
        ),
        page: 1,
        pageSize: 10,
    })
    return (
        <p data-testid="probe">
            {error
                ? error.message
                : data
                  ? data.entries.map((entry) => entry.attributeLabel).join(',')
                  : 'pending'}
        </p>
    )
}

describe('useTrackedEntityChangelog', () => {
    it('renders the page when `attributes` is a new array on every render', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})

        await render(
            <Provider
                config={{
                    baseUrl: 'https://dhis2.test',
                    apiVersion: 43,
                    serverVersion: { full: '2.43.0', major: 2, minor: 43 },
                }}
                userInfo={undefined}
                plugin={false}
                parentAlertsAdd={undefined}
                showAlertsInPlugin={false}
            >
                <CustomDataProvider
                    data={{
                        'system/info': {
                            calendar: 'iso8601',
                            dateFormat: 'yyyy-mm-dd',
                        },
                        'tracker/trackedEntities/TrackedEnt1/changeLogs': {
                            pager: { page: 1, pageSize: 10 },
                            changeLogs: [
                                {
                                    createdBy: { username: 'admin' },
                                    createdAt: '2026-10-23T15:52:02.386',
                                    type: 'CREATE',
                                    change: {
                                        attributeValue: {
                                            attribute: 'AttrFirst01',
                                            currentValue: 'Grace',
                                        },
                                    },
                                },
                            ],
                        },
                    }}
                >
                    <QueryClientProvider client={queryClient}>
                        <Boundary>
                            <InlineAttributesProbe />
                        </Boundary>
                    </QueryClientProvider>
                </CustomDataProvider>
            </Provider>
        )

        await expect
            .element(page.getByTestId('probe'))
            .toHaveTextContent('First name')
        expect(page.getByTestId('crash').query()).toBeNull()
        error.mockRestore()
    })
})

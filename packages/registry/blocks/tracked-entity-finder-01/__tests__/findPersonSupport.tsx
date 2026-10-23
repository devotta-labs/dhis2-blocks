import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { type ComponentProps } from 'react'
import { page, userEvent } from 'vitest/browser'
// Test support only: neither block's __tests__ directory is shipped.
import { renderWithQueries } from '../../tracked-entity-finder/__tests__/finderTestSupport'
import { FindPerson } from '../FindPerson'

// The Sierra Leone demo uids FindPerson uses.
const PROGRAM = 'WSGAb5XwJ3Y'
export const ID_ATTRIBUTE = 'lZGmxYbs97q'
export const FIRST_NAME = 'w75KJ2mc4zz'
export const DATE_OF_BIRTH = 'gHGyrwKPzej'

const attribute = (id: string, displayName: string, valueType: string) => ({
    searchable: true,
    displayInList: true,
    trackedEntityAttribute: {
        id,
        displayName,
        valueType,
        unique: id === ID_ATTRIBUTE,
    },
})

/** The `GET programs/WSGAb5XwJ3Y` answer, trimmed to the attributes used. */
const program = {
    displayName: 'WHO RMNCH Tracker',
    minAttributesRequiredToSearch: 1,
    maxTeiCountToReturn: 0,
    trackedEntityType: { id: 'nEenWmSyUEp' },
    programTrackedEntityAttributes: [
        attribute(ID_ATTRIBUTE, 'Unique ID', 'TEXT'),
        attribute(FIRST_NAME, 'First name', 'TEXT'),
        attribute(DATE_OF_BIRTH, 'Birth date', 'DATE'),
    ],
}

const mariama = {
    trackedEntity: 'te1',
    trackedEntityType: 'nEenWmSyUEp',
    orgUnit: 'DiszpKrYNg8',
    programOwners: [{ orgUnit: 'DiszpKrYNg8', program: PROGRAM }],
    attributes: [
        { attribute: ID_ATTRIBUTE, value: 'RMNCH-0042' },
        { attribute: FIRST_NAME, value: 'Mariama' },
        { attribute: DATE_OF_BIRTH, value: '1994-05-12' },
    ],
}

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

export const renderFindPerson = () => {
    const onSelect = vi.fn()
    // The `filter` of each search the finder sends.
    const searches: unknown[] = []
    const data: CustomData = {
        programs: program,
        'system/info': { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
        'tracker/trackedEntities': async (_type, query) => {
            searches.push(query.params?.filter)
            return {
                trackedEntities: [mariama],
                pager: { page: 1, pageSize: 10, total: 1 },
            }
        },
    }
    renderWithQueries(
        <CustomDataProvider data={data}>
            <FindPerson onSelect={onSelect} />
        </CustomDataProvider>
    )
    return { onSelect, searches }
}

export const typeDate = async (label: string, text: string) => {
    await userEvent.fill(page.getByLabelText(label), text)
    // CalendarInput reports a typed date when the input loses focus.
    await userEvent.tab()
}

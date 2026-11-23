import type { CDPSession } from '@vitest/browser-playwright'
import { cdp, commands, page, userEvent } from 'vitest/browser'
import {
    CHILD_VISIT,
    CHILD_VISIT_PATH,
    childVisitProgram,
    SAVED_VISIT,
} from '../test/childVisit'
import { editable, recorded, renderForm } from '../test/serve'
import type { EventFormSaved } from './EventForm'

const CHC = {
    path: CHILD_VISIT_PATH,
    displayName: 'Ngelehun CHC',
    geometry: { type: 'Point', coordinates: [-11.4197, 8.1039] },
}
const DISTRICT = {
    path: CHILD_VISIT_PATH,
    displayName: 'Badjia',
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [-12, 8],
                [-11, 8],
                [-11, 9],
                [-12, 9],
                [-12, 8],
            ],
        ],
    },
}
const point = {
    program: childVisitProgram({ featureType: 'POINT' }),
    orgUnit: CHC,
}

const latitude = () => page.getByRole('textbox', { name: 'Latitude' })
const longitude = () => page.getByRole('textbox', { name: 'Longitude' })
const button = (name: string) => page.getByRole('button', { name })
const save = () => button('Save')

interface SentEvent {
    geometry?: unknown
}

const sentEvent = (request: { data?: unknown }) =>
    // SAFETY: the form sends one event in a tracker import; the assertions check its parts.
    (request.data as { events: [SentEvent] }).events[0] satisfies SentEvent

const typeCoordinate = async (text: string) => {
    await userEvent.fill(longitude(), '')
    await userEvent.fill(latitude(), text)
    await userEvent.click(longitude())
}
const leave = () =>
    userEvent.click(page.getByRole('textbox', { name: 'Weight (kg)' }))

const fillWeight = () =>
    userEvent.fill(page.getByRole('textbox', { name: 'Weight (kg)' }), '12')

// SAFETY: these tests run on the playwright provider, whose `cdp()` is a CDP session.
const devtools = () => cdp() as CDPSession

const geolocation = async (outcome: 'found' | 'refused' | 'unavailable') => {
    onTestFinished(async () => {
        await devtools().send('Emulation.clearGeolocationOverride')
        await commands.resetLocation()
    })
    if (outcome === 'found') {
        await commands.findLocation({
            latitude: 8.1327,
            longitude: -11.4197,
            accuracy: 12,
        })
    } else if (outcome === 'refused') {
        await commands.refuseLocation()
    } else {
        await commands.allowLocation()
        await devtools().send('Emulation.setGeolocationOverride', {})
    }
}

test('only a point stage asks for a location, and for the org unit’s name and geometry', async () => {
    const { to } = await renderForm({ orgUnit: CHC })
    await editable()
    expect(latitude().query()).toBeNull()
    expect(to('organisationUnits')).toHaveLength(0)
})

test('a point stage shows the location after the event date, with the org unit asked for once', async () => {
    const { to } = await renderForm(point)
    await editable()
    await expect
        .element(page.getByRole('group', { name: 'Location' }))
        .toBeVisible()
    await expect.element(button('Use my location')).toBeVisible()
    await expect.element(button('At Ngelehun CHC')).toBeVisible()
    expect(to('organisationUnits')).toEqual([
        expect.objectContaining({
            id: CHILD_VISIT.orgUnitId,
            params: { fields: 'path,displayName,geometry' },
        }),
    ])
})

test('a coordinate typed in any accepted form is shown as its latitude and longitude', async () => {
    await renderForm(point)
    await editable()
    for (const text of [
        '8.4871, -13.2356',
        `8°29'13.6"N 13°14'08.2"W`,
        'https://www.google.com/maps/@8.4871,-13.2356,15z',
    ]) {
        await typeCoordinate(text)
        await expect
            .element(latitude())
            .toHaveValue(text.startsWith('8°') ? '8.487111' : '8.4871')
        await expect
            .element(longitude())
            .toHaveValue(text.startsWith('8°') ? '-13.235611' : '-13.2356')
    }
})

test('"At" the org unit fills its coordinates, and without locationWarnKm the form says nothing of the distance', async () => {
    const {
        callback: onDirtyChange,
        values: dirtyWith,
        until: dirtied,
    } = recorded<boolean>()
    await renderForm(point, { onDirtyChange })
    await editable()
    await button('At Ngelehun CHC').click()
    await expect.element(latitude()).toHaveValue('8.1039')
    await expect.element(longitude()).toHaveValue('-11.4197')
    await dirtied((values) => values.length > 0)
    expect(dirtyWith).toEqual([true])
    await typeCoordinate('-11.42, 8.47')
    await leave()
    await expect.element(latitude()).toHaveValue('-11.42')
    expect(
        page.getByText(/from Ngelehun CHC|right way round/).query()
    ).toBeNull()
})

test('with locationWarnKm, the form says how far a point is, and warns past that distance', async () => {
    await renderForm(point, { locationWarnKm: 25 })
    await editable()
    await button('At Ngelehun CHC').click()
    await expect.element(page.getByText('0 m from Ngelehun CHC')).toBeVisible()
    await typeCoordinate('8.4, -11.4197')
    await leave()
    await expect
        .element(
            page.getByText(
                'Warning: This point is 33 km from Ngelehun CHC. Check the latitude and longitude are the right way round.'
            )
        )
        .toBeVisible()
})

test('a far point warns, and saves all the same as a point, longitude first', async () => {
    const {
        callback: onSaved,
        values: savedWith,
        until: saved,
    } = recorded<EventFormSaved>()
    const { to } = await renderForm(point, { onSaved, locationWarnKm: 100 })
    await editable()
    await typeCoordinate('-11.42, 8.47')
    await leave()
    await expect
        .element(
            page.getByText(
                /^Warning: This point is [\d,]+ km from Ngelehun CHC\. Check the latitude and longitude are the right way round\.$/
            )
        )
        .toBeVisible()
    await fillWeight()
    await save().click()
    await saved((values) => values.length > 0)
    expect(savedWith).toHaveLength(1)
    expect(sentEvent(to('tracker')[0]).geometry).toEqual({
        type: 'Point',
        coordinates: [8.47, -11.42],
    })
})

test('a point in an org unit’s area says it is inside, and outside with a warning', async () => {
    await renderForm({ ...point, orgUnit: DISTRICT }, { locationWarnKm: 100 })
    await editable()
    expect(button('At Badjia').query()).toBeNull()
    await typeCoordinate('8.5, -11.5')
    await leave()
    await expect.element(page.getByText('Inside Badjia')).toBeVisible()
    await typeCoordinate('8.5, -10.5')
    await leave()
    await expect
        .element(page.getByText('Warning: Outside Badjia'))
        .toBeVisible()
})

test('an edit shows the stored point, and clearing it sends null', async () => {
    const { to } = await renderForm(point, { eventId: CHILD_VISIT.eventId })
    await editable()
    await expect.element(latitude()).toHaveValue('8.47')
    await expect.element(longitude()).toHaveValue('-11.42')
    await userEvent.fill(latitude(), '')
    await userEvent.fill(longitude(), '')
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    expect(sentEvent(to('tracker')[0]).geometry).toBeNull()
})

test('a refused location says why and leaves the field as it was', async () => {
    await geolocation('refused')
    await renderForm(point, { eventId: CHILD_VISIT.eventId })
    await editable()
    await button('Use my location').click()
    await expect
        .element(
            page.getByText(/^Warning: Your location is blocked for this site/)
        )
        .toBeVisible()
    await expect.element(latitude()).toHaveValue('8.47')
})

test('a device that cannot find the location says so', async () => {
    await geolocation('unavailable')
    await renderForm(point)
    await editable()
    await button('Use my location').click()
    await expect
        .element(
            page.getByText(/^Warning: Your device could not find your location/)
        )
        .toBeVisible()
    await expect.element(latitude()).toHaveValue('')
})

test('"Use my location" fills the field and says how close it is', async () => {
    await geolocation('found')
    await renderForm(point)
    await editable()
    await expect.element(latitude()).toHaveValue('')
    await button('Use my location').click()
    await expect.element(latitude()).toHaveValue('8.1327')
    await expect.element(longitude()).toHaveValue('-11.4197')
    await expect
        .element(page.getByText('Your location, within 12 m'))
        .toBeVisible()
})

test('a browser without geolocation says so', async () => {
    const api = Object.getOwnPropertyDescriptor(
        Navigator.prototype,
        'geolocation'
    )
    Reflect.deleteProperty(Navigator.prototype, 'geolocation')
    onTestFinished(() => {
        if (api !== undefined) {
            Object.defineProperty(Navigator.prototype, 'geolocation', api)
        }
    })
    await renderForm(point)
    await editable()
    await button('Use my location').click()
    await expect
        .element(
            page.getByText(
                'Warning: This browser cannot give your location. Type the coordinates instead.'
            )
        )
        .toBeVisible()
})

test('a locked event shows its location read-only, without the buttons', async () => {
    await renderForm(
        {
            ...point,
            program: childVisitProgram({
                featureType: 'POINT',
                blockEntryForm: true,
            }),
            event: { ...SAVED_VISIT, status: 'COMPLETED' },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await expect
        .element(page.getByRole('textbox', { name: 'Location' }), {
            timeout: 10_000,
        })
        .toHaveValue('8.47, -11.42')
    await expect
        .element(page.getByRole('textbox', { name: 'Location' }))
        .toHaveAttribute('readonly')
    expect(button('Use my location').query()).toBeNull()
    expect(button('At Ngelehun CHC').query()).toBeNull()
})

test('DHIS2’s error about the geometry is shown on the location', async () => {
    await renderForm({
        ...point,
        refuse: {
            status: 'ERROR',
            validationReport: {
                errorReports: [
                    {
                        errorCode: 'E1012',
                        message:
                            'Geometry does not conform to FeatureType: `POINT`.',
                        trackerType: 'EVENT',
                        args: ['POINT'],
                    },
                ],
            },
        },
    })
    await editable()
    await fillWeight()
    await save().click()
    await expect
        .element(
            page.getByText(
                'Error: Geometry does not conform to FeatureType: `POINT`.'
            )
        )
        .toBeVisible()
    await expect
        .element(button('Location: Geometry does not conform to FeatureType'))
        .toBeVisible()
})

test('a polygon stage shows a stored area as recorded and sends it back as it is', async () => {
    const area = { type: 'Polygon', coordinates: DISTRICT.geometry.coordinates }
    const { to } = await renderForm(
        {
            program: childVisitProgram({ featureType: 'POLYGON' }),
            event: { ...SAVED_VISIT, geometry: area },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await expect
        .element(page.getByRole('textbox', { name: 'Location' }))
        .toHaveValue('Area recorded')
    expect(button('Use my location').query()).toBeNull()
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    expect(sentEvent(to('tracker')[0]).geometry).toEqual(area)
    expect(to('organisationUnits')).toHaveLength(0)
})

test('a new event on a polygon stage shows no location', async () => {
    await renderForm({ program: childVisitProgram({ featureType: 'POLYGON' }) })
    await editable()
    expect(page.getByRole('textbox', { name: 'Location' }).query()).toBeNull()
    expect(latitude().query()).toBeNull()
})

test('while saving, the location keeps its buttons, unable to change it', async () => {
    const { to } = await renderForm({ ...point, held: ['tracker'] })
    await editable()
    await userEvent.click(page.getByRole('textbox', { name: 'Weight (kg)' }))
    await userEvent.keyboard('12')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    await expect
        .poll(() => document.querySelectorAll('[inert] input').length)
        .toBe(5)
    for (const name of ['Use my location', 'At Ngelehun CHC']) {
        await expect
            .element(page.getByRole('button', { name }))
            .toHaveAttribute('aria-disabled', 'true')
    }
})

import { page, userEvent } from 'vitest/browser'
import {
    CHILD_VISIT,
    CHILD_VISIT_PATH,
    childVisitProgram,
    SAVED_VISIT,
} from '../__tests__/childVisit'
import { editable, renderForm } from '../__tests__/serve'

const CHC = {
    path: CHILD_VISIT_PATH,
    displayName: 'Ngelehun CHC',
    geometry: { type: 'Point', coordinates: [-11.4197, 8.1039] },
}
const point = {
    program: childVisitProgram({ featureType: 'POINT' }),
    orgUnit: CHC,
}
const stage = (featureType: string) => ({
    program: childVisitProgram({ featureType }),
})

// An area of three points, as pasted (latitude first), and as GeoJSON stores it: longitude first, closed.
const PASTED = '8.1, -11.1\n8.2, -11.2\n8.2, -11.1'
const RING = [
    [-11.1, 8.1],
    [-11.2, 8.2],
    [-11.1, 8.2],
    [-11.1, 8.1],
]

const coordinate = () => page.getByRole('textbox', { name: 'Coordinate' })
const area = () => page.getByRole('textbox', { name: 'Area' })
const button = (name: string) => page.getByRole('button', { name })
const save = () => button('Save')
/** The location box's own button named `name`, if it has one: other fields have a Clear too. */
const inBox = (box: ReturnType<typeof area>, name: string) =>
    box
        .element()
        .closest('[data-slot=input-group]')
        ?.querySelector(`button[aria-label="${name}"]`) ?? null

interface SentEvent {
    geometry?: unknown
}

const sentEvent = (request: { data?: unknown }): SentEvent =>
    // SAFETY: the form sends one event in a tracker import; the assertions check its parts.
    (request.data as { events: [SentEvent] }).events[0]

/** What the one save sent as the event's geometry. */
const sentGeometry = async (to: (resource: string) => { data?: unknown }[]) => {
    await expect.poll(() => to('tracker')).toHaveLength(1)
    return sentEvent(to('tracker')[0]).geometry
}

const fillWeight = () =>
    userEvent.fill(page.getByRole('textbox', { name: 'Weight (kg)' }), '12')

const paste = (element: Element, text: string) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    element.dispatchEvent(
        new ClipboardEvent('paste', {
            clipboardData,
            bubbles: true,
            cancelable: true,
        })
    )
}

afterEach(() => {
    vi.restoreAllMocks()
})

test('a stage without a feature type has no location, and asks for no org unit', async () => {
    const { to } = await renderForm({ orgUnit: CHC })
    await editable()
    expect(coordinate().query()).toBeNull()
    expect(area().query()).toBeNull()
    expect(to('organisationUnits')).toHaveLength(0)
})

test('a point stage shows the coordinate, with the org unit’s name and geometry asked for once', async () => {
    const { to } = await renderForm(point)
    await editable()
    await expect.element(coordinate()).toBeVisible()
    await expect.element(button('Use my location')).toBeVisible()
    expect(to('organisationUnits')).toEqual([
        expect.objectContaining({
            id: CHILD_VISIT.orgUnitId,
            params: { fields: 'path,displayName,geometry' },
        }),
    ])
})

test('a point typed is saved as a GeoJSON point, longitude first', async () => {
    const onSaved = vi.fn()
    const { to } = await renderForm(point, { onSaved })
    await editable()
    await userEvent.fill(coordinate(), '8.4871, -13.2356')
    await fillWeight()
    await save().click()
    expect(await sentGeometry(to)).toEqual({
        type: 'Point',
        coordinates: [-13.2356, 8.4871],
    })
    await expect.poll(() => onSaved.mock.calls).toHaveLength(1)
})

test('a coordinate that cannot be read holds Save back, and sends nothing', async () => {
    const { to } = await renderForm(point)
    await editable()
    await userEvent.fill(coordinate(), 'by the big mango tree')
    await fillWeight()
    await save().click()
    // On the field, and in the summary of what holds Save back.
    await expect
        .poll(
            () =>
                page
                    .getByText(
                        'Not a coordinate. Type latitude, then longitude.'
                    )
                    .all().length
        )
        .toBe(2)
    expect(to('tracker')).toHaveLength(0)

    await userEvent.fill(coordinate(), '8.4871, -13.2356')
    await save().click()
    expect(await sentGeometry(to)).toEqual({
        type: 'Point',
        coordinates: [-13.2356, 8.4871],
    })
})

test('with locationWarnKm, a point further from the org unit warns, and saves all the same', async () => {
    const { to } = await renderForm(point, { locationWarnKm: 25 })
    await editable()
    // 33 km north of the CHC: past 25 km.
    await userEvent.fill(coordinate(), '8.4, -11.4197')
    await fillWeight()
    await expect
        .element(
            page.getByText(
                '33 km from Ngelehun CHC. Check latitude and longitude are not swapped.'
            )
        )
        .toBeVisible()
    await save().click()
    expect(await sentGeometry(to)).toEqual({
        type: 'Point',
        coordinates: [-11.4197, 8.4],
    })
})

test('the device’s location fills the point', async () => {
    vi.spyOn(navigator.geolocation, 'watchPosition').mockImplementation(
        (found) => {
            // SAFETY: the field reads only the coordinates and their accuracy.
            found({
                coords: { latitude: 8.1327, longitude: -11.4197, accuracy: 6 },
                timestamp: Date.now(),
            } as GeolocationPosition)
            return 1
        }
    )
    vi.spyOn(navigator.geolocation, 'clearWatch').mockImplementation(
        () => undefined
    )
    const { to } = await renderForm(point)
    await editable()
    await button('Use my location').click()
    await fillWeight()
    await save().click()
    expect(await sentGeometry(to)).toEqual({
        type: 'Point',
        coordinates: [-11.4197, 8.1327],
    })
})

test('an edit shows the stored point, and clearing it sends null', async () => {
    const { to } = await renderForm(stage('POINT'), {
        eventId: CHILD_VISIT.eventId,
    })
    await editable()
    await expect.element(coordinate()).toHaveValue('8.47, -11.42')
    const clear = inBox(coordinate(), 'Clear')
    expect(clear).not.toBeNull()
    await userEvent.click(clear ?? document.body)
    await save().click()
    expect(await sentGeometry(to)).toBeNull()
})

test('a locked event shows its point read-only, without the buttons', async () => {
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
        .element(coordinate(), { timeout: 10_000 })
        .toHaveAttribute('readonly')
    expect(button('Use my location').query()).toBeNull()
    expect(inBox(coordinate(), 'Clear')).toBeNull()
    await expect.element(button('Show on map')).toBeVisible()
})

test('DHIS2’s error about the geometry is shown on the field, which it marks invalid', async () => {
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
    await expect.element(coordinate()).toHaveAttribute('aria-invalid', 'true')
    await button('Coordinate: Geometry does not conform to FeatureType').click()
    await expect.element(coordinate()).toHaveFocus()
})

test('while saving, the location keeps its buttons, out of reach', async () => {
    const { to } = await renderForm(
        { ...point, held: ['tracker'] },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await fillWeight()
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    await expect.element(coordinate()).toHaveAttribute('readonly')
    // Drawn as they were, out of reach until the form unlocks.
    for (const name of ['Clear', 'Use my location', 'Open map']) {
        expect(
            document.querySelector(`[inert] button[aria-label="${name}"]`)
        ).not.toBeNull()
    }
})

test('a polygon stage asks for the org unit, and saves a pasted area as a polygon', async () => {
    const { to } = await renderForm(stage('POLYGON'))
    await editable()
    await expect.element(button('Add my location as a point')).toBeVisible()
    paste(area().element(), PASTED)
    await expect.element(area()).toHaveDisplayValue(/\sha$/)
    await fillWeight()
    await save().click()
    expect(await sentGeometry(to)).toEqual({
        type: 'Polygon',
        coordinates: [RING],
    })
    expect(to('organisationUnits')).toEqual([
        expect.objectContaining({
            params: { fields: 'path,displayName,geometry' },
        }),
    ])
})

test('a MULTI_POLYGON stage saves an area as a multi-polygon of one part', async () => {
    const { to } = await renderForm(stage('MULTI_POLYGON'))
    await editable()
    paste(area().element(), PASTED)
    await fillWeight()
    await save().click()
    expect(await sentGeometry(to)).toEqual({
        type: 'MultiPolygon',
        coordinates: [[RING]],
    })
})

test('a MULTI_POLYGON stage opens a stored multi-polygon of one part as an area it can change', async () => {
    const stored = { type: 'MultiPolygon', coordinates: [[RING]] }
    const onDirtyChange = vi.fn()
    const { to } = await renderForm(
        {
            ...stage('MULTI_POLYGON'),
            event: { ...SAVED_VISIT, geometry: stored },
        },
        { eventId: CHILD_VISIT.eventId, onDirtyChange }
    )
    await editable()
    await expect.element(area()).toHaveDisplayValue(/\sha$/)
    expect(inBox(area(), 'Clear')).not.toBeNull()
    await save().click()
    expect(await sentGeometry(to)).toEqual(stored)
    expect(onDirtyChange).not.toHaveBeenCalled()
})

test('an area of several parts is shown as recorded, and sent back as it is', async () => {
    const stored = {
        type: 'MultiPolygon',
        coordinates: [
            [RING],
            [
                [
                    [-12.1, 8.1],
                    [-12.2, 8.2],
                    [-12.1, 8.2],
                    [-12.1, 8.1],
                ],
            ],
        ],
    }
    const { to } = await renderForm(
        {
            ...stage('MULTI_POLYGON'),
            event: { ...SAVED_VISIT, geometry: stored },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await expect.element(area()).toHaveValue('Area recorded')
    expect(inBox(area(), 'Clear')).toBeNull()
    await save().click()
    expect(await sentGeometry(to)).toEqual(stored)
})

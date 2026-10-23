import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ProfileFieldValue } from '../../types'
import {
    ProfileWidgetField,
    ProfileWidgetFieldList,
    ProfileWidgetValue,
} from '../fields'

const renderValue = (value: ProfileFieldValue, label = 'Value') =>
    render(
        <ProfileWidgetFieldList>
            <ProfileWidgetField label={label}>
                <ProfileWidgetValue value={value} className="custom-value" />
            </ProfileWidgetField>
        </ProfileWidgetFieldList>
    )

describe('ProfileWidgetValue', () => {
    it('renders nothing for an empty value but keeps the row', async () => {
        const screen = await renderValue({ kind: 'empty' }, 'Nickname')

        await expect
            .element(screen.getByRole('term'))
            .toHaveTextContent('Nickname:')
        const definition = screen.getByRole('definition')
        expect(definition.element().childElementCount).toBe(0)
        expect(definition.element().textContent).toBe('')
    })

    it('renders text with the value slot and kind', async () => {
        const screen = await renderValue({ kind: 'text', text: 'Ingrid' })

        const text = screen.getByText('Ingrid')
        await expect.element(text).toBeVisible()
        await expect
            .element(text)
            .toHaveAttribute('data-slot', 'profile-widget-value')
        await expect.element(text).toHaveAttribute('data-kind', 'text')
        await expect.element(text).toHaveClass('custom-value')
    })

    it('names a file link "File" when the value has no name', async () => {
        const screen = await renderValue({
            kind: 'file',
            name: '',
            href: '/api/41/tracker/trackedEntities/te/attributes/at/file',
        })

        await expect
            .element(screen.getByRole('link', { name: 'File' }))
            .toBeVisible()
    })

    it('renders a file as a link named after the file that opens in a new tab', async () => {
        const screen = await renderValue({
            kind: 'file',
            name: 'consent.pdf',
            href: '/api/41/tracker/trackedEntities/te/attributes/at/file',
        })

        const link = screen.getByRole('link', { name: 'consent.pdf' })
        await expect
            .element(link)
            .toHaveAttribute(
                'href',
                '/api/41/tracker/trackedEntities/te/attributes/at/file'
            )
        await expect.element(link).toHaveAttribute('target', '_blank')
        await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders an image as a 120x80 preview linking to the full image', async () => {
        const screen = await renderValue({
            kind: 'image',
            href: '/full.png',
            previewHref:
                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"/%3E',
            alt: 'Photo',
        })

        const image = screen.getByRole('img', { name: 'Photo' })
        await expect.element(image).toBeVisible()
        expect(image.element().getAttribute('src')).toContain('data:image/svg')
        const link = screen.getByRole('link', { name: 'Photo' })
        await expect.element(link).toHaveAttribute('href', '/full.png')
        await expect.element(link).toHaveAttribute('target', '_blank')
        const box = image.element().getBoundingClientRect()
        expect(box.height).toBe(80)
        expect(box.width).toBeLessThanOrEqual(120)
    })

    it('renders an org unit name with its ancestor path as tooltip and description', async () => {
        const screen = await renderValue({
            kind: 'organisationUnit',
            name: 'Ngelehun CHC',
            path: ['Sierra Leone', 'Bo', 'Badjia'],
        })

        const name = screen.getByText('Ngelehun CHC', { exact: true })
        await expect.element(name).toBeVisible()
        await expect
            .element(name)
            .toHaveAttribute('data-kind', 'organisationUnit')
        await expect
            .element(name)
            .toHaveAccessibleDescription(
                'Sierra Leone / Bo / Badjia / Ngelehun CHC'
            )

        await name.hover()
        await expect
            .element(
                page
                    .getByText('Sierra Leone / Bo / Badjia / Ngelehun CHC')
                    .last()
            )
            .toBeVisible()
    })

    it('renders a root org unit without a tooltip', async () => {
        const screen = await renderValue({
            kind: 'organisationUnit',
            name: 'Sierra Leone',
            path: [],
        })

        const name = screen.getByText('Sierra Leone')
        await expect.element(name).toBeVisible()
        expect(name.element().hasAttribute('tabindex')).toBe(false)
        expect(name.element().hasAttribute('aria-describedby')).toBe(false)
    })

    it("renders coordinates the way Capture's MinimalCoordinates does", async () => {
        const screen = await renderValue({
            kind: 'coordinate',
            latitude: 8.0123,
            longitude: -11.75,
        })

        const coordinate = screen.getByRole('definition')
        await expect
            .element(coordinate)
            .toHaveTextContent('Lat: 8.012300Long: -11.750000')
        expect(coordinate.element().querySelector('br')).not.toBeNull()
    })

    it('renders a polygon as the literal "Polygon"', async () => {
        const screen = await renderValue({ kind: 'polygon' })

        await expect.element(screen.getByText('Polygon')).toBeVisible()
    })
})

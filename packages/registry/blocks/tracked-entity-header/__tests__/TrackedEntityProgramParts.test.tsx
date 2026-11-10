import { formatDhis2Value } from '@/components/dhis2-value-display'
import React from 'react'
import { page } from 'vitest/browser'
import type { ResourceRequest } from '../api/client'
import { displayLocale } from '../format/display'
import {
    TrackedEntityEnrollment,
    TrackedEntityOwner,
    TrackedEntityStatus,
} from '..'
import { renderParts, type Edit, type RawPerson } from './valuePartsSupport'

const flags =
    (inactive: boolean, potentialDuplicate: boolean): Edit<RawPerson> =>
    (raw) => ({ ...raw, inactive, potentialDuplicate })

const date = (iso: string) =>
    formatDhis2Value(
        iso,
        { valueType: 'DATE' },
        { calendar: 'gregorian', locale: displayLocale() }
    )

const enrollment =
    (changes: Partial<RawPerson['enrollments'][number]>): Edit<RawPerson> =>
    (raw) => ({
        ...raw,
        enrollments: raw.enrollments.map((one) => ({ ...one, ...changes })),
    })

describe('TrackedEntityStatus', () => {
    it('says Inactive', async () => {
        await renderParts(<TrackedEntityStatus />, {
            person: flags(true, false),
        })

        await expect.element(page.getByText('Inactive')).toBeVisible()
        await expect
            .element(page.getByText('Possible duplicate'))
            .not.toBeInTheDocument()
    })

    it('says Possible duplicate', async () => {
        await renderParts(<TrackedEntityStatus />, {
            person: flags(false, true),
        })

        await expect.element(page.getByText('Possible duplicate')).toBeVisible()
        await expect.element(page.getByText('Inactive')).not.toBeInTheDocument()
    })

    it('says both', async () => {
        await renderParts(<TrackedEntityStatus />, {
            person: flags(true, true),
        })

        await expect.element(page.getByText('Inactive')).toBeVisible()
        await expect.element(page.getByText('Possible duplicate')).toBeVisible()
    })

    it('renders nothing for an ordinary person', async () => {
        await renderParts(
            <div data-testid="part">
                <TrackedEntityStatus />
            </div>
        )

        await expect.element(page.getByTestId('part')).toBeInTheDocument()
        expect(page.getByTestId('part').element().childElementCount).toBe(0)
    })

    it('renders nothing before the person is ready', async () => {
        await renderParts(
            <div data-testid="part">
                <TrackedEntityStatus />
            </div>,
            { status: 'loading', person: flags(true, true) }
        )

        expect(page.getByTestId('part').element().childElementCount).toBe(0)
    })
})

describe('TrackedEntityOwner', () => {
    it('names the owner org unit after one request', async () => {
        const requests: ResourceRequest[] = []
        await renderParts(<TrackedEntityOwner />, { requests })

        await expect
            .element(page.getByText('Owned by Ngelehun CHC'))
            .toBeVisible()
        expect(
            requests.filter((r) => r.resource === 'organisationUnits')
        ).toHaveLength(1)
    })

    it('shares one request between two owners', async () => {
        const requests: ResourceRequest[] = []
        await renderParts(
            <>
                <TrackedEntityOwner />
                <TrackedEntityOwner />
            </>,
            { requests }
        )

        await expect
            .element(page.getByText('Owned by Ngelehun CHC').first())
            .toBeVisible()
        expect(
            requests.filter((r) => r.resource === 'organisationUnits')
        ).toHaveLength(1)
    })

    it('asks for no org unit when the part is not mounted', async () => {
        const requests: ResourceRequest[] = []
        await renderParts(<TrackedEntityStatus />, { requests })

        await expect.poll(() => requests.length).toBeGreaterThan(0)
        expect(
            requests.filter((r) => r.resource === 'organisationUnits')
        ).toHaveLength(0)
    })

    it('shows a skeleton while the org unit loads', async () => {
        await renderParts(
            <div data-testid="part">
                <TrackedEntityOwner />
            </div>,
            { orgUnitStatus: 'loading' }
        )

        await expect
            .poll(() =>
                page
                    .getByTestId('part')
                    .element()
                    .querySelector('[data-slot="skeleton"]')
            )
            .not.toBeNull()
    })

    it('says Owned by Unavailable when the org unit fails', async () => {
        await renderParts(<TrackedEntityOwner />, { orgUnitStatus: 'failed' })

        await expect.element(page.getByText('Owned by')).toBeVisible()
        await expect.element(page.getByText('Unavailable')).toBeVisible()
    })

    it('names the missing program prop without one', async () => {
        await renderParts(<TrackedEntityOwner />, { program: null })

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent('program')
    })
})

describe('TrackedEntityEnrollment', () => {
    it('says Active since the enrollment date', async () => {
        await renderParts(<TrackedEntityEnrollment />)

        await expect
            .element(
                page.getByText(
                    `Active since ${date('2026-01-10T12:05:00.000')}`
                )
            )
            .toBeVisible()
    })

    it('says Completed with the completion date', async () => {
        await renderParts(<TrackedEntityEnrollment />, {
            person: enrollment({
                status: 'COMPLETED',
                completedAt: '2025-10-26T09:00:00.000',
            }),
        })

        await expect
            .element(
                page.getByText(`Completed ${date('2025-10-26T09:00:00.000')}`)
            )
            .toBeVisible()
    })

    it('says Cancelled', async () => {
        await renderParts(<TrackedEntityEnrollment />, {
            person: enrollment({ status: 'CANCELLED' }),
        })

        await expect.element(page.getByText('Cancelled')).toBeVisible()
    })

    it('says Not enrolled without an enrollment in the program', async () => {
        await renderParts(<TrackedEntityEnrollment />, {
            person: (raw) => ({ ...raw, enrollments: [] }),
        })

        await expect.element(page.getByText('Not enrolled')).toBeVisible()
    })

    it('names the missing program prop without one', async () => {
        await renderParts(<TrackedEntityEnrollment />, { program: null })

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent('program')
    })
})

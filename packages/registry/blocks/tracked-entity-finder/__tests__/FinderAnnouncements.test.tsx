import React, { StrictMode, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { page } from 'vitest/browser'
import { announce } from '@/components/dhis2/ui/announcer'
import { useFinderResults } from '../hooks'
import { hivProgram } from './fixtures/program'
import { FinderResults } from '../results/FinderResults'
import {
    FinderEmpty,
    FinderSearching,
    FinderTooMany,
} from '../results/FinderStates'
import {
    amina,
    answer,
    entity,
    renderFinder,
    searchFor,
    ui,
} from './resultsTestSupport'

const liveRegion = () => {
    const region = document.querySelector<HTMLElement>(
        'body > [role="status"][aria-live="polite"]'
    )
    if (!region) throw new Error('The shared polite live region is missing')
    return region
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 400))

let said: string[]
let observer: MutationObserver

beforeEach(async () => {
    announce('')
    await settle()
    said = []
    observer = new MutationObserver(() => {
        const text = liveRegion().textContent
        if (text) said.push(text)
    })
    observer.observe(liveRegion(), {
        childList: true,
        characterData: true,
        subtree: true,
    })
})

afterEach(async () => {
    observer.disconnect()
    await settle()
})

test('uses one shared live region across repeated searches and outcomes', async () => {
    const { server } = await renderFinder({
        options: { deferSearches: true },
    })
    const region = liveRegion()
    const results = page.getByTestId('results')
    const expected: string[] = []
    const outcomes = [
        { response: answer([]), text: 'No one found' },
        {
            response: answer([amina], 6),
            text: 'Too many matches. Add another detail.',
        },
        { response: answer([amina]), text: '1 person found' },
        { response: answer([]), text: 'No one found' },
    ]

    for (const [index, outcome] of outcomes.entries()) {
        await searchFor(`A${index + 1}`)
        await expect.element(results.getByText('Searching…')).toBeVisible()
        await expect.element(results).toHaveAttribute('aria-busy', 'true')
        expect(
            results.element().querySelector('[role="status"], [aria-live]')
        ).toBeNull()
        expect(region.closest('[aria-busy="true"]')).toBeNull()
        expected.push('Searching…')
        await expect.poll(() => said).toEqual(expected)

        server.pendingSearches[index].respond(outcome.response)
        await expect.element(results).toHaveAttribute('aria-busy', 'false')
        expected.push(outcome.text)
        await expect.poll(() => said).toEqual(expected)
        if (outcome.text === '1 person found') {
            await expect
                .element(results.getByRole('button', { name: /Amina/ }))
                .toBeVisible()
        }
        expect(liveRegion()).toBe(region)
    }
    await settle()
    expect(said).toEqual(expected)
})

test('counts new searches once, not paging, cached pages or background refreshes', async () => {
    const Refresh = () => {
        const queryClient = useQueryClient()
        return (
            <button
                type="button"
                onClick={() => {
                    void queryClient.invalidateQueries({
                        queryKey: ['tracked-entity-finder', 'search'],
                    })
                }}
            >
                Refresh results
            </button>
        )
    }
    const { server } = await renderFinder({
        options: {
            program: { ...hivProgram, maxTeiCountToReturn: 0 },
            deferSearches: true,
        },
        results: (
            <>
                <FinderResults data-testid="results" />
                <Refresh />
            </>
        ),
    })
    const results = page.getByTestId('results')
    await searchFor('A1')
    await expect.poll(() => said).toEqual(['Searching…'])
    const firstPage = Array.from({ length: 10 }, (_, i) =>
        entity(`p1-${i}`, { firstName: `Person${i}` })
    )
    server.pendingSearches[0].respond(answer(firstPage, 12))
    await expect.poll(() => said).toEqual(['Searching…', '12 people found'])

    await page.getByRole('button', { name: 'Next' }).click()
    await expect.element(results).toHaveAttribute('aria-busy', 'true')
    await settle()
    expect(said).toEqual(['Searching…', '12 people found'])
    server.pendingSearches[1].respond(answer([amina], 12, 2))
    await expect
        .element(results.getByRole('button', { name: /Amina/ }))
        .toBeVisible()
    await page.getByRole('button', { name: 'Previous' }).click()
    await expect
        .element(results.getByText('Person0', { exact: true }))
        .toBeVisible()

    await page.getByRole('button', { name: 'Refresh results' }).click()
    await expect.poll(() => server.pendingSearches.length).toBe(3)
    await expect.element(results).toHaveAttribute('aria-busy', 'true')
    server.pendingSearches[2].respond(answer([amina]))
    await expect.element(results).toHaveAttribute('aria-busy', 'false')
    await settle()
    expect(said).toEqual(['Searching…', '12 people found'])

    await searchFor('A1')
    await expect
        .poll(() => said)
        .toEqual(['Searching…', '12 people found', '1 person found'])
    await settle()
    expect(said).toHaveLength(3)
    expect(server.pendingSearches).toHaveLength(3)
})

test.each([
    { count: 2, message: '2 people found' },
    { count: 10, message: 'At least 10 people found' },
])(
    'announces $message when the server omits totals',
    async ({ count, message }) => {
        await renderFinder({
            options: {
                program: { ...hivProgram, maxTeiCountToReturn: 0 },
                searchResponse: {
                    trackedEntities: Array.from({ length: count }, (_, i) =>
                        entity(`person${i}`)
                    ),
                },
            },
        })
        await searchFor('A1')
        await expect.poll(() => said).toContain(message)
        await settle()
        expect(said.filter((text) => text !== 'Searching…')).toEqual([message])
    }
)

test('announces custom JSX and independent child updates without duplicate speech', async () => {
    const updates = new EventTarget()
    const Message = () => {
        const [text, setText] = useState('Nobody')
        useEffect(() => {
            const update = () => setText('No one at this clinic')
            updates.addEventListener('change', update)
            return () => updates.removeEventListener('change', update)
        }, [])
        return (
            <>
                <strong>{text}</strong> matched
            </>
        )
    }
    const results = (
        <FinderResults data-testid="results">
            <FinderSearching>Looking…</FinderSearching>
            <FinderEmpty
                data-testid="empty"
                className="custom-empty"
                title="Details"
            >
                <Message />
            </FinderEmpty>
            <FinderTooMany data-testid="too-many">
                Narrow your search
            </FinderTooMany>
        </FinderResults>
    )
    const { server, screen, onSelect } = await renderFinder({
        options: { deferSearches: true },
        results,
    })
    await searchFor('A1')
    await expect.poll(() => said).toEqual(['Looking…'])
    server.pendingSearches[0].respond(answer([]))
    await expect.poll(() => said).toEqual(['Looking…', 'Nobody matched'])
    const empty = page.getByTestId('empty')
    await expect.element(empty).toHaveClass('custom-empty')
    await expect.element(empty).toHaveAttribute('title', 'Details')

    updates.dispatchEvent(new Event('change'))
    await expect
        .poll(() => said)
        .toEqual([
            'Looking…',
            'Nobody matched',
            'No one at this clinic matched',
        ])
    await screen.rerender(
        ui(
            'hivProgram',
            onSelect,
            React.cloneElement(results, { className: 'rerendered' })
        )
    )
    await settle()
    expect(said).toEqual([
        'Looking…',
        'Nobody matched',
        'No one at this clinic matched',
    ])

    await searchFor('A2')
    await expect.poll(() => said.at(-1)).toBe('Looking…')
    server.pendingSearches[1].respond(answer([amina], 6))
    await expect.poll(() => said.at(-1)).toBe('Narrow your search')
    expect(
        page.getByTestId('results').element().querySelector('[role="status"]')
    ).toBeNull()

    const detached = page.getByTestId('too-many').element()
    const before = [...said]
    await screen.rerender(<></>)
    detached.textContent = 'Do not announce detached content'
    await settle()
    expect(said).toEqual(before)
})

test('announces a status mounted in StrictMode only once', async () => {
    const ResultState = () => {
        const { status } = useFinderResults()
        return <output data-testid="state">{status}</output>
    }
    const { screen, onSelect } = await renderFinder({
        results: <ResultState />,
    })
    await searchFor('A1')
    await expect.element(page.getByTestId('state')).toHaveTextContent('empty')
    await screen.rerender(
        ui(
            'hivProgram',
            onSelect,
            <StrictMode>
                <FinderResults>
                    <FinderEmpty>No matches</FinderEmpty>
                </FinderResults>
            </StrictMode>
        )
    )
    await expect.poll(() => said).toEqual(['No matches'])
    await settle()
    expect(said).toEqual(['No matches'])
})

test('respects hidden content and accessible labels in custom messages', async () => {
    const results = (children: React.ReactNode) => (
        <FinderResults>
            <FinderEmpty>{children}</FinderEmpty>
        </FinderResults>
    )
    const { screen, onSelect } = await renderFinder({
        results: results(
            <>
                <span aria-hidden="true">Decorative icon</span>
                <span hidden>Not part of the message</span>
                No matches
            </>
        ),
    })
    await searchFor('A1')
    await expect.poll(() => said).toEqual(['No matches'])

    const icon = (label: string) => (
        <svg role="img" aria-label={label}>
            <title>Not the accessible label</title>
        </svg>
    )
    await screen.rerender(
        ui('hivProgram', onSelect, results(icon('Nobody matched')))
    )
    await expect.poll(() => said).toEqual(['No matches', 'Nobody matched'])
    await screen.rerender(
        ui('hivProgram', onSelect, results(icon('Try another detail')))
    )
    await expect
        .poll(() => said)
        .toEqual(['No matches', 'Nobody matched', 'Try another detail'])

    await screen.rerender(
        ui('hivProgram', onSelect, results(<img alt="No one found" />))
    )
    await expect.poll(() => said.at(-1)).toBe('No one found')
    await screen.rerender(
        ui(
            'hivProgram',
            onSelect,
            results(<img alt="No one found" aria-hidden="true" />)
        )
    )
    await settle()
    expect(said).toHaveLength(4)
    await screen.rerender(
        ui(
            'hivProgram',
            onSelect,
            results(
                <>
                    <img alt="No matches" />
                    Try <strong>ag</strong>ain
                    <span role="img" aria-label="later" />
                </>
            )
        )
    )
    await expect.poll(() => said.at(-1)).toBe('No matches Try again later')
})

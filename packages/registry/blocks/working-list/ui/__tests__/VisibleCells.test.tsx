import React from 'react'
import { render } from 'vitest-browser-react'
import type { WorkingListField } from '../../domain/model'
import type { WorkingListDisplayRow } from '../../provider/contracts'
import { visibleRowsAsCsv } from '../../provider/results'
import { WorkingListDataTable } from '../WorkingListTable/WorkingListTable'
import { WorkingListTextProvider } from '../WorkingListText'

const translate = (message: string) => `localized:${message}`
const field = (
    id: string,
    valueType: WorkingListField['valueType'] = 'TEXT'
): WorkingListField => ({
    id,
    valueType,
    displayName: id,
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    filterable: false,
})
const fields: WorkingListField[] = [
    {
        ...field('eventStatus'),
        source: 'system',
        options: [{ code: 'ACTIVE', displayName: 'Active' }],
    },
    {
        ...field('Choice'),
        options: [{ code: 'ACTIVE', displayName: 'Active metadata' }],
    },
    {
        ...field('enrolledAt'),
        source: 'system',
        displayName: 'Metadata date',
        displayNameIsMetadata: true,
    },
    field('Text'),
    field('Link', 'URL'),
    field('Image', 'IMAGE'),
    field('File', 'FILE_RESOURCE'),
    field('Hidden'),
]
const formattingContext = {
    resolveFileResourceName: () => 'Report "final".pdf',
}
const columns = [
    'Text',
    'eventStatus',
    'Choice',
    'enrolledAt',
    'Link',
    'Image',
    'File',
]
const row: WorkingListDisplayRow = {
    id: 'visible-row',
    issues: [],
    values: {
        eventStatus: { valid: true, value: 'ACTIVE' },
        Choice: { valid: true, value: 'ACTIVE' },
        enrolledAt: { valid: true, value: 'Metadata value' },
        Text: { valid: true, value: 'Line "one"\nLine two' },
        Link: { valid: true, value: 'https://example.test/result' },
        Image: {
            valid: true,
            value: {
                id: 'Image000001',
                url: '/local-image',
                previewUrl: '/local-preview',
            },
        },
        File: { valid: true, value: { id: 'File0000001', url: '/local-file' } },
        Hidden: { valid: true, value: 'not visible' },
    },
}

const renderTable = (
    rows: WorkingListDisplayRow[],
    allFields = fields,
    visibleColumnIds = columns
) =>
    render(
        <WorkingListTextProvider translate={translate}>
            <WorkingListDataTable
                allFields={allFields}
                visibleColumnIds={visibleColumnIds}
                rows={rows}
                sort={{ fieldId: 'Text', direction: 'asc' }}
                page={3}
                pageSize={15}
                hasNextPage
                isInitialLoading={false}
                isUpdating={false}
                formattingContext={formattingContext}
                onPageChange={() => undefined}
                onPageSizeChange={() => undefined}
                onSortChange={() => undefined}
            />
        </WorkingListTextProvider>
    )

describe('visible table and CSV semantics', () => {
    it('shares localized status, verbatim metadata, image alt, file/link labels and visible order', async () => {
        const screen = await renderTable([row])
        const cells = Array.from(
            screen.container.querySelectorAll('tbody td'),
            (cell) => cell.querySelector('img')?.alt ?? cell.textContent
        )
        expect(cells).toEqual([
            'Line "one"\nLine two',
            'localized:Active',
            'Active metadata',
            'Metadata value',
            'https://example.test/result',
            'localized:Image attachment',
            'Report "final".pdf',
        ])
        await expect
            .element(
                screen.getByRole('columnheader', {
                    name: 'localized:Event status',
                })
            )
            .toBeVisible()
        await expect
            .element(
                screen.getByRole('columnheader', { name: 'Metadata date' })
            )
            .toBeVisible()
        await expect
            .element(
                screen.getByRole('link', {
                    name: 'https://example.test/result',
                })
            )
            .toHaveAttribute('href', 'https://example.test/result')
        await expect
            .element(screen.getByRole('link', { name: 'Report "final".pdf' }))
            .toHaveAttribute('href', '/local-file')
        await expect
            .element(
                screen.getByRole('img', { name: 'localized:Image attachment' })
            )
            .toHaveAttribute('src', '/local-preview')
        expect(screen.container.querySelectorAll('tbody tr')).toHaveLength(1)
        const csv = visibleRowsAsCsv({
            rows: [row],
            columns,
            fields: new Map(fields.map((item) => [item.id, item])),
            formattingContext,
            translate,
        })
        expect(csv).toBe(
            '"Text","localized:Event status","Choice","Metadata date","Link","Image","File"\n"Line ""one""\nLine two","localized:Active","Active metadata","Metadata value","https://example.test/result","localized:Image attachment","Report ""final"".pdf"'
        )
        expect(csv).not.toContain('not visible')
        await screen.unmount()
    })

    it('uses identical empty/scalar/fallback text for invalid cells without dropping rows', async () => {
        const invalidValues = [
            undefined,
            null,
            '',
            false,
            42,
            'unparsed',
            { unexpected: 'object' },
            ['array'],
        ]
        const rows: WorkingListDisplayRow[] = invalidValues.map(
            (raw, index) => ({
                id: `row-${index}`,
                values: {
                    Text: { valid: false, raw, message: 'Invalid cell' },
                },
                issues: [
                    {
                        fieldId: 'Text',
                        fieldName: 'Text',
                        message: 'Invalid cell',
                        raw,
                    },
                ],
            })
        )
        rows.push({ id: 'missing-cell', values: {}, issues: [] })
        const screen = await renderTable(rows, [field('Text')], ['Text'])
        expect(
            Array.from(
                screen.container.querySelectorAll('tbody td'),
                (cell) => cell.textContent
            )
        ).toEqual(['', '', '', 'false', '42', 'unparsed', '-', '-', ''])
        expect(screen.container.querySelectorAll('tbody tr')).toHaveLength(9)
        expect(
            visibleRowsAsCsv({
                rows,
                columns: ['Text'],
                fields: new Map([['Text', field('Text')]]),
                formattingContext,
                translate,
            })
        ).toBe('"Text"\n""\n""\n""\n"false"\n"42"\n"unparsed"\n"-"\n"-"\n""')
        await screen.unmount()
    })
})

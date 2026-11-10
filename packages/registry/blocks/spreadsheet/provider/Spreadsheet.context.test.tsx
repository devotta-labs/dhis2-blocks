/// <reference types="@vitest/browser-playwright" />
import { CustomDataProvider } from '@dhis2/app-runtime'
import { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { createStore } from 'zustand/vanilla'
import type { AnnotationsState } from '../model/annotations'
import { createCellStore } from '../store/store'
import { Spreadsheet } from './Spreadsheet'
import { useSpreadsheetContext } from './context'
import type { SpreadsheetContext } from './context'

const SETTINGS = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
const TABLES: [] = []

test('the context stays the same object when the app re-renders', async () => {
    const annotations = createStore<AnnotationsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    const cells = createCellStore({
        fields: new Map(),
        fieldIdOf: (key) => key,
        values: new Map(),
        settings: SETTINGS,
        annotations,
        enqueue: vi.fn(),
    })
    const seen: SpreadsheetContext[] = []
    const Probe = () => {
        const context = useSpreadsheetContext()
        seen.push(context)
        return null
    }
    const App = () => {
        const [count, setCount] = useState(0)
        return (
            <CustomDataProvider data={{}}>
                <button type="button" onClick={() => setCount(count + 1)}>
                    Render {count}
                </button>
                <Spreadsheet
                    cells={cells}
                    annotations={annotations}
                    tables={TABLES}
                    settings={SETTINGS}
                    idScope="context"
                >
                    <Probe />
                </Spreadsheet>
            </CustomDataProvider>
        )
    }
    const screen = await render(<App />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('button'))
    expect(seen.length).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(1)
})

import { CustomDataProvider } from '@dhis2/app-runtime'
import { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { ValueInput } from '../ValueInput'
import type { ValueInputProps } from '../ValueInput'

const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}

/**
 * A file field over a server whose uploads never answer. The host keeps its last good value and the problem apart,
 * as the docs' form does; `shown` false takes the field off the page.
 */
const mount = async () => {
    const reports: Array<Parameters<ValueInputProps['onChange']>> = []
    const aborted: boolean[] = []
    let problem: string | undefined
    const Host = ({ shown }: { shown: boolean }) => {
        const [value, setValue] = useState<string | undefined>('oldFileId1')
        return (
            <CustomDataProvider
                data={{
                    fileResources: (_type, _request, execute) =>
                        new Promise(() => {
                            execute?.signal?.addEventListener('abort', () =>
                                aborted.push(true)
                            )
                        }),
                }}
            >
                {shown ? (
                    <ValueInput
                        field={{ valueType: 'FILE_RESOURCE' }}
                        settings={SETTINGS}
                        label="Referral letter"
                        value={value}
                        onChange={(next, given) => {
                            reports.push([next, given])
                            problem = given?.message
                            if (given === undefined) {
                                setValue(next ?? undefined)
                            }
                        }}
                    />
                ) : null}
            </CustomDataProvider>
        )
    }
    const screen = await render(<Host shown />)
    return {
        reports,
        aborted,
        problem: () => problem,
        unmount: () => screen.rerender(<Host shown={false} />),
    }
}

test('a field that leaves mid-upload gives a host that kept its file that file back, without the problem', async () => {
    const { reports, aborted, problem, unmount } = await mount()
    const picker = document.querySelector('input[type="file"]')
    if (picker === null) {
        throw new Error('The field has no file input')
    }
    await userEvent.upload(
        picker,
        new File(['x'], 'scan.txt', { type: 'text/plain' })
    )
    await expect.poll(() => problem()).toBe('Still uploading')

    await unmount()
    await expect.poll(() => aborted).toEqual([true])
    expect(reports.at(-1)).toEqual(['oldFileId1', undefined])
    expect(problem()).toBeUndefined()
})

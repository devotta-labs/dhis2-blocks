import { CustomDataProvider } from '@dhis2/app-runtime'
import { act, type ReactNode } from 'react'

const answer = (id: string) => ({
    status: 'OK',
    response: { fileResource: { id, name: `${id}.txt` } },
})

interface Upload {
    signal: AbortSignal | undefined
    release(): Promise<void>
    fail(): Promise<void>
}

export const uploadServer = () => {
    const requests = new Map<number, PromiseWithResolvers<Upload>>()
    let nextRequest = 1
    const request = (number: number) => {
        let pending = requests.get(number)
        if (pending === undefined) {
            pending = Promise.withResolvers<Upload>()
            requests.set(number, pending)
        }
        return pending
    }

    const Server = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider
            data={{
                fileResources: (_type, _request, execute) => {
                    const number = nextRequest++
                    const response =
                        Promise.withResolvers<ReturnType<typeof answer>>()
                    request(number).resolve({
                        signal: execute?.signal,
                        async release() {
                            await act(async () => {
                                response.resolve(answer(`File${number}`))
                                await response.promise
                            })
                        },
                        async fail() {
                            await act(async () => {
                                const error = new Error('Disk full')
                                response.reject(error)
                                await expect(response.promise).rejects.toBe(
                                    error
                                )
                            })
                        },
                    })
                    return response.promise
                },
            }}
        >
            {children}
        </CustomDataProvider>
    )

    return { Server, upload: (number: number) => request(number).promise }
}

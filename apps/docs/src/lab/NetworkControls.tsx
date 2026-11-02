import type { Endpoint, LabNetwork } from './network'

const BEHAVIOURS = [
    [undefined, 'OK', 'Answers'],
    ['fails', '500', 'Fails with a 500'],
    ['hangs', 'HANG', 'Never answers'],
] as const

const toDelay = (value: string) =>
    value === '' ? undefined : Math.max(0, Math.round(Number(value)) || 0)

const row = 'grid grid-cols-[minmax(0,1fr)_3.5rem_auto] items-center gap-1'

/** A default delay, then each endpoint's own delay (blank uses the default) and whether it answers. */
export const NetworkControls = ({
    network,
    endpoints,
    onChange,
}: {
    network: LabNetwork
    endpoints: readonly string[]
    onChange: (network: LabNetwork) => void
}) => {
    const setEndpoint = (name: string, changes: Endpoint) =>
        onChange({
            ...network,
            endpoints: {
                ...network.endpoints,
                [name]: { ...network.endpoints[name], ...changes },
            },
        })

    return (
        <div className="flex flex-col gap-0.5 text-[11px]">
            <label className={row}>
                <span className="text-(--lab-ink-3)">DEFAULT MS</span>
                <input
                    type="number"
                    min={0}
                    step={100}
                    className="text-end"
                    value={network.delay}
                    onChange={(event) =>
                        onChange({
                            ...network,
                            delay: toDelay(event.target.value) ?? 0,
                        })
                    }
                />
            </label>
            {endpoints.map((name) => {
                const endpoint = network.endpoints[name]
                return (
                    <div
                        key={name}
                        role="group"
                        aria-label={name}
                        className={`${row} hover:bg-(--lab-rule-faint)`}
                    >
                        <span
                            className={`truncate ${endpoint?.delay !== undefined || endpoint?.behaviour ? 'font-bold' : ''}`}
                            title={name}
                        >
                            {name}
                        </span>
                        <input
                            type="number"
                            min={0}
                            step={100}
                            aria-label="Delay (ms)"
                            placeholder={String(network.delay)}
                            className="text-end"
                            value={endpoint?.delay ?? ''}
                            onChange={(event) =>
                                setEndpoint(name, {
                                    delay: toDelay(event.target.value),
                                })
                            }
                        />
                        <span className="flex">
                            {BEHAVIOURS.map(([behaviour, short, long]) => (
                                <label
                                    key={short}
                                    title={long}
                                    className="relative"
                                >
                                    <input
                                        type="radio"
                                        name={`behaviour-${name}`}
                                        aria-label={long}
                                        className="peer sr-only"
                                        checked={
                                            endpoint?.behaviour === behaviour
                                        }
                                        onChange={() =>
                                            setEndpoint(name, { behaviour })
                                        }
                                    />
                                    <span className="-ms-px block cursor-pointer border border-(--lab-rule) px-1 text-[10px] leading-[18px] peer-checked:border-(--lab-ink) peer-checked:bg-(--lab-ink) peer-checked:text-(--lab-paper) peer-focus-visible:outline-2 peer-focus-visible:outline-(--lab-ink) hover:bg-(--lab-rule-faint) peer-checked:hover:bg-(--lab-ink)">
                                        {short}
                                    </span>
                                </label>
                            ))}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

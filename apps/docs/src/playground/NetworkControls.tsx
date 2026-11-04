import { Section, Segmented } from './controls'
import type { LabNetwork } from './network'

type NetworkChoice = 'normal' | 'slow' | 'fails' | 'hangs'

const CHOICES: ReadonlyArray<readonly [NetworkChoice, string]> = [
    ['normal', 'Normal'],
    ['slow', 'Slow'],
    ['fails', 'Fails'],
    ['hangs', 'Hangs'],
]

const NORMAL_DELAY = 250
const SLOW_DELAY = 2000

/** The network for a choice: every request slow, or the block's records failing or never coming. */
const networkFor = (
    choice: NetworkChoice,
    records: readonly string[]
): LabNetwork => {
    if (choice === 'normal' || choice === 'slow') {
        return {
            delay: choice === 'slow' ? SLOW_DELAY : NORMAL_DELAY,
            endpoints: {},
        }
    }
    return {
        delay: NORMAL_DELAY,
        endpoints: Object.fromEntries(
            records.map((resource) => [resource, { behaviour: choice }])
        ),
    }
}

const choiceOf = (network: LabNetwork): NetworkChoice => {
    const behaviours = Object.values(network.endpoints).map(
        (endpoint) => endpoint?.behaviour
    )
    if (behaviours.includes('hangs')) return 'hangs'
    if (behaviours.includes('fails')) return 'fails'
    return network.delay >= SLOW_DELAY ? 'slow' : 'normal'
}

/** How the fake server's network behaves, as one choice; `records` are the resources that fail or hang. */
export const NetworkControls = ({
    network,
    records,
    onChange,
}: {
    network: LabNetwork
    records: readonly string[]
    onChange: (network: LabNetwork) => void
}) => (
    <Section title="Network">
        <Segmented
            value={choiceOf(network)}
            options={CHOICES}
            onChange={(choice) => onChange(networkFor(choice, records))}
        />
    </Section>
)

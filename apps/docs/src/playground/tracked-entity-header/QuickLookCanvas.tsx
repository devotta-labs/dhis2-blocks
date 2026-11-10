import { Button } from '@/components/dhis2/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import {
    TrackedEntityAttribute,
    TrackedEntityDate,
    TrackedEntityFacts,
    TrackedEntityHeaderProvider,
    TrackedEntityName,
    TrackedEntityStatus,
    useTrackedEntityHeader,
} from '@/components/tracked-entity-header'
import type { LabSettings } from './labData'
import type { Parts } from './labSubjects'

interface Props {
    trackedEntity: string
    program: string
    parts: Parts
    settings: Pick<LabSettings, 'width'>
}

/** The whole-record states are the host's own outside a frame. */
const QuickLookStatus = () => {
    const state = useTrackedEntityHeader()
    if (state.status === 'loading') {
        return <p className="m-0">Loading</p>
    }
    if (state.status === 'restricted') {
        return <p className="m-0">You don't have access to this record</p>
    }
    if (state.status === 'not-found') {
        return <p className="m-0">This record doesn't exist</p>
    }
    return (
        <>
            <p className="m-0">Couldn't load this record</p>
            <Button variant="outline" onClick={state.retry}>
                Retry
            </Button>
        </>
    )
}

const QuickLook = ({ parts }: Pick<Props, 'parts'>) => {
    const { status } = useTrackedEntityHeader()
    if (status !== 'ready') {
        return <QuickLookStatus />
    }
    return (
        <>
            <TrackedEntityName id="quick-look-name" attributes={parts.name} />
            <TrackedEntityStatus />
            <TrackedEntityDate {...parts.date} />
            <TrackedEntityFacts>
                <TrackedEntityAttribute attribute={parts.fact} />
            </TrackedEntityFacts>
        </>
    )
}

/** The parts in a popover, with no banner: the record loads when it opens. */
export const QuickLookCanvas = ({
    trackedEntity,
    program,
    parts,
    settings,
}: Props) => (
    <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline" className="w-fit" />}>
            Quick look
        </PopoverTrigger>
        <PopoverContent
            align="start"
            aria-labelledby="quick-look-name"
            className={settings.width === 'narrow' ? 'w-72' : 'w-[360px]'}
        >
            <TrackedEntityHeaderProvider
                trackedEntity={trackedEntity}
                program={program}
            >
                <QuickLook parts={parts} />
            </TrackedEntityHeaderProvider>
        </PopoverContent>
    </Popover>
)

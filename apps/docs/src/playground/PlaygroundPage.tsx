import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { PLAYGROUND_BLOCKS, type PlaygroundSlug } from './blocks'
import { LabPicker } from './labPicker'

/** Each block's lab, loaded when its page opens, so the docs never carry a lab they do not show. */
const LABS = {
    'working-list': lazy(() =>
        import('./working-list/WorkingListLab').then(({ WorkingListLab }) => ({
            default: WorkingListLab,
        }))
    ),
    'observation-cards': lazy(() =>
        import('./observation-cards/ObservationsLab').then(
            ({ ObservationsLab }) => ({ default: ObservationsLab })
        )
    ),
    timeline: lazy(() =>
        import('./timeline/TimelineLab').then(({ TimelineLab }) => ({
            default: TimelineLab,
        }))
    ),
    'tracked-entity-finder': lazy(() =>
        import('./tracked-entity-finder/FinderLab').then(({ FinderLab }) => ({
            default: FinderLab,
        }))
    ),
    'tracker-data-entry': lazy(() =>
        import('./tracker-data-entry/TrackerDataEntryLab').then(
            ({ TrackerDataEntryLab }) => ({ default: TrackerDataEntryLab })
        )
    ),
} satisfies Record<PlaygroundSlug, ComponentType>

const isPlaygroundSlug = (slug?: string): slug is PlaygroundSlug =>
    PLAYGROUND_BLOCKS.some((block) => block.slug === slug)

/** Picks the block on show; a new block opens on its first preset. */
const BlockPicker = ({ slug }: { slug: PlaygroundSlug }) => {
    const navigate = useNavigate()
    return (
        <Select
            items={PLAYGROUND_BLOCKS.map(({ slug, title }) => ({
                value: slug,
                label: title,
            }))}
            value={slug}
            onValueChange={(next) => {
                if (next) navigate(`/playground/${next}`)
            }}
        >
            <SelectTrigger
                aria-label="Block"
                size="sm"
                className="min-h-9 rounded-md border-input bg-background ps-3 pe-2 text-sm font-medium text-foreground shadow-none hover:bg-muted focus-visible:border-ring focus-visible:shadow-none data-popup-open:border-ring data-popup-open:shadow-none [&>span]:text-muted-foreground"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent className="mt-1 rounded-md border-border bg-card p-1 text-card-foreground shadow-md">
                {PLAYGROUND_BLOCKS.map((block) => (
                    <SelectItem
                        key={block.slug}
                        value={block.slug}
                        className="rounded-sm py-1.5 text-sm text-foreground data-highlighted:bg-muted data-selected:bg-transparent [&>span:first-child]:text-primary"
                    >
                        {block.title}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

/** `/playground/:slug`: one block's lab under the docs header. An unknown or missing slug opens the first block. */
export const PlaygroundPage = () => {
    const { slug } = useParams()
    if (!isPlaygroundSlug(slug)) {
        return (
            <Navigate to={`/playground/${PLAYGROUND_BLOCKS[0].slug}`} replace />
        )
    }
    const Lab = LABS[slug]
    return (
        <div className="h-[calc(100dvh-3.5rem)]">
            <LabPicker.Provider value={<BlockPicker slug={slug} />}>
                <Suspense fallback={<div className="h-full bg-muted" />}>
                    <Lab key={slug} />
                </Suspense>
            </LabPicker.Provider>
        </div>
    )
}

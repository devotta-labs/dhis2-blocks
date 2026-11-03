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
    'working-list-calendar': lazy(() =>
        import('./working-list-calendar/CalendarLab').then(
            ({ CalendarLab }) => ({ default: CalendarLab })
        )
    ),
    'observation-cards': lazy(() =>
        import('./observation-cards/ObservationsLab').then(
            ({ ObservationsLab }) => ({ default: ObservationsLab })
        )
    ),
} satisfies Record<PlaygroundSlug, ComponentType>

const isPlaygroundSlug = (slug?: string): slug is PlaygroundSlug =>
    PLAYGROUND_BLOCKS.some((block) => block.slug === slug)

/** Picks the block on show; a new block opens on its own saved settings, without the last one's preset. */
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
                className="rounded-none border-(--lab-rule) bg-(--lab-paper-inset) text-xs tracking-normal text-(--lab-ink) normal-case shadow-none hover:bg-(--lab-paper-inset) focus-visible:border-(--lab-ink) focus-visible:shadow-none data-popup-open:border-(--lab-ink) data-popup-open:shadow-none [&>span]:text-(--lab-ink)"
            >
                <SelectValue />
            </SelectTrigger>
            {/* The menu opens outside the lab, so it brings the lab's tokens and type along. */}
            <SelectContent className="lab lab-chrome rounded-none border-(--lab-ink) bg-(--lab-paper) text-(--lab-ink) shadow-none">
                {PLAYGROUND_BLOCKS.map((block) => (
                    <SelectItem
                        key={block.slug}
                        value={block.slug}
                        className="py-1 text-xs text-(--lab-ink) data-highlighted:bg-(--lab-paper-inset) data-selected:bg-transparent [&>span:first-child]:text-(--lab-ink)"
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

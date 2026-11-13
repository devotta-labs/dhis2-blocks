import { Button } from '@/components/dhis2/ui/button'
import {
    Pane,
    PaneContent,
    PaneGroup,
    PaneHandle,
    PaneHeader,
    Section,
    Toolbar,
    ToolbarButton,
    ToolbarDivider,
    ToolbarSpacer,
} from '@/components/shell'
import {
    IconAdd16,
    IconDownload16,
    IconFilter16,
    IconMore16,
    IconSync16,
} from '@dhis2/ui-icons'
import type { ReactNode } from 'react'
import {
    canvasDensity,
    outerDensity,
    type DensityMode,
    type PrimitiveExample,
} from './examples'
import { Facts } from './Facts'
import { Rows } from './Rows'

interface Props {
    example: PrimitiveExample
    density: DensityMode
}

const VISITS = Array.from({ length: 40 }, (_, index) => ({
    id: `visit${index}`,
    name: `Visit ${index + 1}`,
    meta: index % 3 === 0 ? 'Overdue' : 'Scheduled',
}))

const FACTS = [
    { label: 'National ID', value: 'SL-004182' },
    { label: 'Age', value: '34 years' },
    { label: 'Village', value: 'Kasana' },
    { label: 'Next visit', value: '10 Dec 2026' },
]

/**
 * The same content in a narrow pane and a wide one. With mixed density the
 * narrow pane is compact and the wide one comfortable.
 */
const Pair = ({
    density,
    children,
}: {
    density: DensityMode
    children: ReactNode
}) => (
    <PaneGroup density={outerDensity(density)}>
        <Pane defaultSize={264} aria-label="Narrow pane">
            {children}
        </Pane>
        <Pane density={canvasDensity(density)} aria-label="Wide pane">
            {children}
        </Pane>
    </PaneGroup>
)

const EXAMPLES = {
    // Groups nest: a row of three panes, the middle one a column of two.
    Layout: (density: DensityMode) => (
        <PaneGroup density={outerDensity(density)}>
            <Pane
                defaultSize={240}
                maxSize={400}
                collapsible
                aria-label="Navigator"
            >
                <PaneHeader title="Navigator" />
                <PaneContent>
                    <Rows items={VISITS.slice(0, 6)} current="visit1" />
                </PaneContent>
            </Pane>
            <PaneHandle aria-label="Resize navigator" />
            <Pane minSize={240}>
                <PaneGroup orientation="vertical">
                    <Pane
                        density={canvasDensity(density)}
                        minSize={120}
                        aria-label="Canvas"
                    >
                        <PaneHeader title="Canvas" />
                        <PaneContent>
                            <Section title="Details">
                                <Facts items={FACTS} />
                            </Section>
                        </PaneContent>
                    </Pane>
                    <PaneHandle aria-label="Resize log" />
                    <Pane
                        side="end"
                        defaultSize={200}
                        minSize={80}
                        collapsible
                        aria-label="Log"
                    >
                        <PaneHeader title="Log" />
                        <PaneContent>
                            <Rows items={VISITS.slice(0, 12)} />
                        </PaneContent>
                    </Pane>
                </PaneGroup>
            </Pane>
            <PaneHandle aria-label="Resize inspector" />
            <Pane
                side="end"
                defaultSize={280}
                maxSize={400}
                collapsible
                aria-label="Inspector"
            >
                <PaneHeader title="Inspector" />
                <PaneContent>
                    <Section title="Properties">
                        <Facts items={FACTS} />
                    </Section>
                </PaneContent>
            </Pane>
        </PaneGroup>
    ),
    Pane: (density: DensityMode) => (
        <Pair density={density}>
            <PaneHeader title="The content scrolls under the header" />
            <PaneContent>
                <Rows items={VISITS} />
            </PaneContent>
        </Pair>
    ),
    PaneHeader: (density: DensityMode) => (
        <Pair density={density}>
            <PaneHeader title="Visits" />
            <PaneHeader title="Visits">
                <Button variant="ghost" size="icon-sm" aria-label="Filter">
                    <IconFilter16 />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="More">
                    <IconMore16 />
                </Button>
            </PaneHeader>
            <PaneHeader title="A long title that runs out of room before the actions">
                <Button variant="ghost" size="icon-sm" aria-label="More">
                    <IconMore16 />
                </Button>
            </PaneHeader>
        </Pair>
    ),
    Toolbar: (density: DensityMode) => (
        <Pair density={density}>
            <Toolbar aria-label="Record actions">
                <ToolbarButton>
                    <IconAdd16 />
                    New visit
                </ToolbarButton>
                <ToolbarButton>
                    <IconDownload16 />
                    Export
                </ToolbarButton>
                <ToolbarDivider />
                <ToolbarButton disabled>
                    <IconSync16 />
                    Sync
                </ToolbarButton>
                <ToolbarSpacer />
                <ToolbarButton primary>Save visit</ToolbarButton>
            </Toolbar>
            <Toolbar aria-label="Icon actions">
                <ToolbarButton aria-label="Filter">
                    <IconFilter16 />
                </ToolbarButton>
                <ToolbarButton aria-label="More">
                    <IconMore16 />
                </ToolbarButton>
            </Toolbar>
        </Pair>
    ),
    Section: (density: DensityMode) => (
        <Pair density={density}>
            <PaneContent>
                <Section title="Open by default">
                    <Facts items={FACTS} />
                </Section>
                <Section title="Flush, with a count" meta={6} flush>
                    <Rows items={VISITS.slice(0, 6)} />
                </Section>
                <Section title="Closed to start with" defaultOpen={false}>
                    None recorded. Ask at the next visit.
                </Section>
                <Section title="A long section title that wraps onto a second line in a narrow pane">
                    The title wraps; the count and the arrow keep their place.
                </Section>
            </PaneContent>
        </Pair>
    ),
} satisfies Record<PrimitiveExample, (density: DensityMode) => ReactNode>

export const ShellCanvas = ({ example, density }: Props) =>
    EXAMPLES[example](density)

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
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListViewSwitcher,
} from '@/components/working-list'
import { HeaderBar } from '@dhis2/ui'
import { IconAdd16, IconDownload16, IconSync16 } from '@dhis2/ui-icons'
import { useState, type ReactNode } from 'react'
import { canvasDensity, outerDensity, type DensityMode } from './examples'
import { Facts } from './Facts'
import { Rows } from './Rows'

interface Props {
    density: DensityMode
    programId: string
    orgUnitId: string
    /** The read-only facts of a row's person, for the inspector. */
    factsOf: (
        trackedEntityId: string
    ) => Array<{ label: string; value?: string }>
    /** The Timeline block, for the inspector. */
    history: ReactNode
}

const LISTS = [
    { id: 'antenatal', name: 'Antenatal care', meta: 230 },
    { id: 'child', name: 'Child programme', meta: 412 },
    { id: 'tb', name: 'TB programme', meta: 38 },
    { id: 'malaria', name: 'Malaria case follow-up', meta: 9 },
]

/**
 * A DHIS2 app: the header bar over a navigator, a working list and an inspector
 * for the selected row. The side panes resize and collapse.
 */
export const AppCanvas = ({
    density,
    programId,
    orgUnitId,
    factsOf,
    history,
}: Props) => {
    const [selected, setSelected] = useState<string>()
    return (
        <div className="flex h-full min-h-0 flex-col">
            <HeaderBar appName="Blocks shell" />
            <div className="min-h-0 flex-1">
                <PaneGroup density={outerDensity(density)}>
                    <Pane
                        defaultSize={264}
                        maxSize={400}
                        collapsible
                        aria-label="Lists"
                    >
                        <PaneHeader title="Lists" />
                        <PaneContent>
                            <Section
                                title="Programmes"
                                meta={LISTS.length}
                                flush
                            >
                                <Rows items={LISTS} current="antenatal" />
                            </Section>
                            <Section title="Organisation unit">
                                <Facts
                                    items={[
                                        {
                                            label: 'Facility',
                                            value: 'Lab clinic',
                                        },
                                        { label: 'District', value: 'Bo' },
                                        { label: 'Catchment' },
                                    ]}
                                />
                            </Section>
                        </PaneContent>
                    </Pane>
                    <PaneHandle aria-label="Resize lists" />

                    <Pane
                        density={canvasDensity(density)}
                        minSize={320}
                        aria-label="Antenatal care"
                    >
                        <Toolbar aria-label="List actions">
                            <ToolbarButton>
                                <IconAdd16 />
                                New visit
                            </ToolbarButton>
                            <ToolbarButton>
                                <IconDownload16 />
                                Export
                            </ToolbarButton>
                            <ToolbarDivider />
                            <ToolbarButton>
                                <IconSync16 />
                                Sync
                            </ToolbarButton>
                            <ToolbarSpacer />
                            <ToolbarButton primary>
                                Register person
                            </ToolbarButton>
                        </Toolbar>
                        <PaneContent>
                            <WorkingList
                                programId={programId}
                                orgUnitId={orgUnitId}
                                defaultPagination={{ page: 1, pageSize: 15 }}
                            >
                                <WorkingListViewSwitcher />
                                <WorkingListToolbar>
                                    <WorkingListColumnSelector />
                                    <WorkingListFilterControls />
                                </WorkingListToolbar>
                                <WorkingListTable
                                    onRowClick={(target) =>
                                        setSelected(target.trackedEntityId)
                                    }
                                />
                            </WorkingList>
                        </PaneContent>
                    </Pane>
                    <PaneHandle aria-label="Resize selection" />

                    <Pane
                        side="end"
                        defaultSize={304}
                        maxSize={480}
                        collapsible
                        aria-label="Selection"
                    >
                        <PaneHeader title="Selection" />
                        <PaneContent>
                            {selected ? (
                                <>
                                    <Section title="Properties">
                                        <Facts
                                            items={factsOf(selected)}
                                            empty="Not recorded"
                                        />
                                    </Section>
                                    <Section title="History">{history}</Section>
                                    <Section
                                        title="Allergies"
                                        defaultOpen={false}
                                    >
                                        None recorded. Ask at the next visit.
                                    </Section>
                                </>
                            ) : (
                                <p className="m-0 p-(--dhis2-pane-pad) text-dhis2-muted-foreground">
                                    Select a row to see the person.
                                </p>
                            )}
                        </PaneContent>
                    </Pane>
                </PaneGroup>
            </div>
        </div>
    )
}

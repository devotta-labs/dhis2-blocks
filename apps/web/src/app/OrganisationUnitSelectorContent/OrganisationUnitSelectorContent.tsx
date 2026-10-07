import { Button, CircularLoader, OrganisationUnitTree } from '@dhis2/ui'
import type { ComponentType, MouseEvent } from 'react'
import React, { useCallback, useMemo, useState } from 'react'
import i18n from '../../i18n'
import type { OrganisationUnitReference } from '../organisationUnitScope'
import {
    buildOrganisationUnitTreeFilter,
    getInitialOrganisationUnitExpandedPaths,
} from './treeFilter'
import styles from './OrganisationUnitSelectorContent.module.css'

interface OrganisationUnitSelectorContentProps {
    roots: OrganisationUnitReference[]
    allowedPaths: string[]
    selected?: OrganisationUnitReference
    searchValue: string
    onSearchChange: (value: string) => void
    searchRoots?: OrganisationUnitReference[]
    searchLoading?: boolean
    searchError?: boolean
    onSearchRetry?: () => void
    treeKey: string
    onSelect: (organisationUnit: OrganisationUnitReference) => void
    treeComponent?: ComponentType<OrganisationUnitTreeRuntimeProps>
}

interface OrganisationUnitTreeRuntimeProps {
    roots: string[]
    filter: string[]
    selected: string[]
    singleSelection: boolean
    expanded: string[]
    handleExpand: (payload: { path: string }) => void
    handleCollapse: (payload: { path: string }) => void
    onChange: (
        payload: OrganisationUnitReference & { checked: boolean },
        event: MouseEvent<HTMLElement>
    ) => void
}

const Dhis2OrganisationUnitTree = (props: OrganisationUnitTreeRuntimeProps) => {
    // SAFETY: The runtime accepts controlled string paths while the published type incorrectly declares a boolean.
    const expanded = props.expanded as never

    return <OrganisationUnitTree {...props} expanded={expanded} />
}

interface ControlledOrganisationUnitTreeProps {
    visibleRoots: OrganisationUnitReference[]
    treeFilter: string[]
    selected?: OrganisationUnitReference
    onSelect: (organisationUnit: OrganisationUnitReference) => void
    TreeComponent: ComponentType<OrganisationUnitTreeRuntimeProps>
}

const ControlledOrganisationUnitTree = ({
    visibleRoots,
    treeFilter,
    selected,
    onSelect,
    TreeComponent,
}: ControlledOrganisationUnitTreeProps) => {
    const [expanded, setExpanded] = useState(() =>
        getInitialOrganisationUnitExpandedPaths(visibleRoots, selected?.path)
    )

    const handleExpand = useCallback(({ path }: { path: string }) => {
        setExpanded((current) =>
            current.includes(path) ? current : [...current, path]
        )
    }, [])

    const handleCollapse = useCallback(({ path }: { path: string }) => {
        setExpanded((current) => current.filter((item) => item !== path))
    }, [])

    return (
        <TreeComponent
            roots={visibleRoots.map((root) => root.id)}
            filter={treeFilter}
            selected={selected ? [selected.path] : []}
            singleSelection
            expanded={expanded}
            handleExpand={handleExpand}
            handleCollapse={handleCollapse}
            onChange={(payload, event) => {
                event.stopPropagation()
                event.preventDefault()

                if (!payload.checked) {
                    return
                }

                onSelect({
                    id: payload.id,
                    displayName: payload.displayName,
                    path: payload.path,
                })
            }}
        />
    )
}

export const OrganisationUnitSelectorContent = ({
    roots,
    allowedPaths,
    selected,
    searchValue,
    onSearchChange,
    searchRoots,
    searchLoading = false,
    searchError = false,
    onSearchRetry,
    treeKey,
    onSelect,
    treeComponent,
}: OrganisationUnitSelectorContentProps) => {
    const TreeComponent = treeComponent ?? Dhis2OrganisationUnitTree
    const visibleRoots = searchRoots ?? roots

    const treeFilter = useMemo(
        () => buildOrganisationUnitTreeFilter(allowedPaths, visibleRoots),
        [allowedPaths, visibleRoots]
    )

    const stableTreeKey = `${treeKey}-${visibleRoots.map((root) => root.id).join('-')}`

    return (
        <div className="z-0 h-full w-full rounded-[3px] border border-[#e8edf2] bg-white">
            <div className="rounded-t-[3px] bg-[#f8f9fa] p-[8px]">
                <input
                    className={styles.searchInput}
                    data-test="org-unit-search-input"
                    type="text"
                    value={searchValue}
                    placeholder={i18n.t('Search')}
                    onChange={(event) =>
                        onSearchChange(event.currentTarget.value)
                    }
                />
            </div>
            <div className="overflow-auto rounded-b-[3px]">
                <div
                    className={
                        searchLoading
                            ? 'm-[4px] flex h-[calc(100vh-48px)] items-center justify-center'
                            : 'flex min-h-[42px] max-w-[100vw] bg-white p-[4px] pt-[8px]'
                    }
                    data-test="org-unit-tree"
                    data-testid="org-unit-tree"
                >
                    {searchError ? (
                        <div
                            className="flex w-full flex-col items-center gap-[8px] px-[16px] py-[24px] text-center text-[14px] text-[#4a5768]"
                            data-test="org-unit-search-error"
                        >
                            <span>
                                {i18n.t('Could not search organisation units')}
                            </span>
                            {onSearchRetry ? (
                                <Button small secondary onClick={onSearchRetry}>
                                    {i18n.t('Try again')}
                                </Button>
                            ) : null}
                        </div>
                    ) : searchLoading ? (
                        <CircularLoader />
                    ) : (
                        <ControlledOrganisationUnitTree
                            key={stableTreeKey}
                            visibleRoots={visibleRoots}
                            treeFilter={treeFilter}
                            selected={selected}
                            onSelect={onSelect}
                            TreeComponent={TreeComponent}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

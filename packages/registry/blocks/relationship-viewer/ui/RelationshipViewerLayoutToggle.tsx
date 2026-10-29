import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import type { RelationshipViewerLayout } from '../provider/contracts'
import {
    useRelationshipViewerActions,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'

export function RelationshipViewerLayoutToggle({
    className,
}: {
    className?: string
}) {
    const { layout } = useRelationshipViewerState()
    const { setLayout } = useRelationshipViewerActions()

    return (
        <ToggleGroup<RelationshipViewerLayout>
            aria-label={i18n.t('Layout')}
            variant="outline"
            size="sm"
            className={className}
            value={[layout]}
            // Pressing the active item would empty the group; the layout stays.
            onValueChange={([next]) => next && setLayout(next)}
        >
            <ToggleGroupItem value="web">{i18n.t('Web')}</ToggleGroupItem>
            <ToggleGroupItem value="timeline">
                {i18n.t('Timeline')}
            </ToggleGroupItem>
        </ToggleGroup>
    )
}

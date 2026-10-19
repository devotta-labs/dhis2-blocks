import type { StageMetadata } from '../api/schemas'

/**
 * Whether the event form can capture this stage. Unsupported value types do not count against it,
 * because they render read-only; a polygon geometry or an attribute category combination cannot be
 * captured at all.
 */
export const canUseEventForm = (
    metadata: StageMetadata
): { ok: true } | { ok: false; reason: 'polygon' | 'categoryCombo' } => {
    if (metadata.stage.featureType === 'POLYGON') {
        return { ok: false, reason: 'polygon' }
    }
    if (metadata.hasCategoryCombo) {
        return { ok: false, reason: 'categoryCombo' }
    }
    return { ok: true }
}

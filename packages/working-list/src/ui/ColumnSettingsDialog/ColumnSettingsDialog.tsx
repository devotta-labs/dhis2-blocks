import {
    Button,
    Checkbox,
    IconDragHandle24,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useEffect, useMemo, useState } from 'react'
import type { WorkingListField } from '../../domain/model'
import { fieldDisplayName } from '../FilterControls'
import { useWorkingListText } from '../WorkingListText'

interface ColumnSettingsDialogProps {
    fields: WorkingListField[]
    visibleColumnIds: string[]
    onChange: (columnIds: string[]) => void
    onClose: () => void
}

/**
 * Keeps metadata order for hidden fields while applying the saved ordering to
 * the visible slots. This means visibility and ordering remain independent.
 */
export const getInitialColumnDialogOrder = (
    fields: WorkingListField[],
    visibleColumnIds: string[]
) => {
    const fieldsById = new Map(fields.map((field) => [field.id, field]))
    const visibleFields = visibleColumnIds
        .map((id) => fieldsById.get(id))
        .filter((field): field is WorkingListField => Boolean(field))
    const visibleIds = new Set(visibleFields.map((field) => field.id))
    let nextVisibleIndex = 0

    return fields.map((field) =>
        visibleIds.has(field.id)
            ? (visibleFields[nextVisibleIndex++] ?? field)
            : field
    )
}

export const getVisibleColumnIdsInOrder = (
    orderedFields: WorkingListField[],
    visibleColumnIds: string[]
) => {
    const visibleIds = new Set(visibleColumnIds)
    return orderedFields
        .map((field) => field.id)
        .filter((id) => visibleIds.has(id))
}

interface SortableColumnRowProps {
    field: WorkingListField
    name: string
    visible: boolean
    disableVisibilityToggle: boolean
    reorderLabel: string
    visibilityLabel: string
    onVisibilityChange: (checked: boolean) => void
}

const SortableColumnRow = ({
    field,
    name,
    visible,
    disableVisibilityToggle,
    reorderLabel,
    visibilityLabel,
    onVisibilityChange,
}: SortableColumnRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: field.id })

    return (
        <li
            ref={setNodeRef}
            className={`column-settings-row${isDragging ? ' column-settings-row--dragging' : ''}`}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            data-testid={`column-settings-row-${field.id}`}
        >
            <button
                type="button"
                className="column-settings-drag-handle"
                aria-label={reorderLabel}
                {...attributes}
                {...listeners}
            >
                <IconDragHandle24 />
            </button>
            <span className="column-settings-name">{name}</span>
            <div className="column-settings-visibility">
                <Checkbox
                    dense
                    dataTest={`column-${field.id}`}
                    checked={visible}
                    disabled={disableVisibilityToggle}
                    label={
                        <span className="visually-hidden">
                            {visibilityLabel}
                        </span>
                    }
                    onChange={({ checked }) => onVisibilityChange(checked)}
                />
            </div>
        </li>
    )
}

export const ColumnSettingsDialog = ({
    fields,
    visibleColumnIds,
    onChange,
    onClose,
}: ColumnSettingsDialogProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const [orderedFields, setOrderedFields] = useState(() =>
        getInitialColumnDialogOrder(fields, visibleColumnIds)
    )
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    useEffect(() => {
        setOrderedFields((current) => {
            const currentIds = new Set(current.map((field) => field.id))
            const fieldsById = new Map(fields.map((field) => [field.id, field]))
            const nextIds = new Set(fields.map((field) => field.id))
            return [
                ...current
                    .filter((field) => nextIds.has(field.id))
                    .map((field) => fieldsById.get(field.id) ?? field),
                ...fields.filter((field) => !currentIds.has(field.id)),
            ]
        })
    }, [fields])

    const fieldNames = useMemo(
        () =>
            new Map(
                fields.map((field) => [
                    field.id,
                    fieldDisplayName(field, translate),
                ])
            ),
        [fields, translate]
    )

    const toggle = (fieldId: string, checked: boolean) => {
        if (!checked && visibleColumnIds.length === 1) {
            return
        }
        const nextVisibleIds = new Set(visibleColumnIds)
        if (checked) {
            nextVisibleIds.add(fieldId)
        } else {
            nextVisibleIds.delete(fieldId)
        }
        onChange(
            orderedFields
                .map((field) => field.id)
                .filter((id) => nextVisibleIds.has(id))
        )
    }

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return
        }
        const oldIndex = orderedFields.findIndex(
            (field) => field.id === active.id
        )
        const newIndex = orderedFields.findIndex(
            (field) => field.id === over.id
        )
        if (oldIndex < 0 || newIndex < 0) {
            return
        }
        const reordered = arrayMove(orderedFields, oldIndex, newIndex)
        setOrderedFields(reordered)
        const reorderedVisibleIds = getVisibleColumnIdsInOrder(
            reordered,
            visibleColumnIds
        )
        if (
            reorderedVisibleIds.some(
                (id, index) => id !== visibleColumnIds[index]
            )
        ) {
            onChange(reorderedVisibleIds)
        }
    }

    return (
        <Modal position="middle" onClose={onClose}>
            <ModalTitle>{i18n.t('Configure columns')}</ModalTitle>
            <ModalContent>
                <div data-testid="column-settings">
                    <p className="column-settings-description">
                        {i18n.t(
                            'Choose which columns are visible and drag them into the order you want. Active filters are not affected.'
                        )}
                    </p>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        accessibility={{
                            screenReaderInstructions: {
                                draggable: i18n.t(
                                    'To reorder a column, press Space to pick it up, use the arrow keys to move it, and press Space again to drop it.'
                                ),
                            },
                            announcements: {
                                onDragStart: ({ active }) =>
                                    i18n.t('{{column}} picked up.', {
                                        column:
                                            fieldNames.get(String(active.id)) ??
                                            String(active.id),
                                    }),
                                onDragOver: ({ active, over }) =>
                                    over
                                        ? i18n.t(
                                              '{{column}} moved to position {{position}} of {{total}}.',
                                              {
                                                  column:
                                                      fieldNames.get(
                                                          String(active.id)
                                                      ) ?? String(active.id),
                                                  position:
                                                      orderedFields.findIndex(
                                                          (field) =>
                                                              field.id ===
                                                              over.id
                                                      ) + 1,
                                                  total: orderedFields.length,
                                              }
                                          )
                                        : undefined,
                                onDragEnd: ({ active, over }) =>
                                    over
                                        ? i18n.t('{{column}} dropped.', {
                                              column:
                                                  fieldNames.get(
                                                      String(active.id)
                                                  ) ?? String(active.id),
                                          })
                                        : i18n.t('{{column}} was not moved.', {
                                              column:
                                                  fieldNames.get(
                                                      String(active.id)
                                                  ) ?? String(active.id),
                                          }),
                                onDragCancel: ({ active }) =>
                                    i18n.t('Reordering {{column}} cancelled.', {
                                        column:
                                            fieldNames.get(String(active.id)) ??
                                            String(active.id),
                                    }),
                            },
                        }}
                        onDragEnd={handleDragEnd}
                    >
                        <div
                            className="column-settings-header"
                            aria-hidden="true"
                        >
                            <span />
                            <span>{i18n.t('Column')}</span>
                            <span>{i18n.t('Visible')}</span>
                        </div>
                        <SortableContext
                            items={orderedFields.map((field) => field.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="column-settings-list">
                                {orderedFields.map((field) => {
                                    const visible = visibleColumnIds.includes(
                                        field.id
                                    )
                                    const name = fieldDisplayName(
                                        field,
                                        translate
                                    )
                                    return (
                                        <SortableColumnRow
                                            key={field.id}
                                            field={field}
                                            name={name}
                                            visible={visible}
                                            disableVisibilityToggle={
                                                visible &&
                                                visibleColumnIds.length === 1
                                            }
                                            reorderLabel={i18n.t(
                                                'Reorder {{column}}',
                                                { column: name }
                                            )}
                                            visibilityLabel={i18n.t(
                                                'Show {{column}}',
                                                { column: name }
                                            )}
                                            onVisibilityChange={(checked) =>
                                                toggle(field.id, checked)
                                            }
                                        />
                                    )
                                })}
                            </ul>
                        </SortableContext>
                    </DndContext>
                </div>
            </ModalContent>
            <ModalActions>
                <Button
                    primary
                    dataTest="column-settings-done"
                    onClick={onClose}
                >
                    {i18n.t('Done')}
                </Button>
            </ModalActions>
        </Modal>
    )
}

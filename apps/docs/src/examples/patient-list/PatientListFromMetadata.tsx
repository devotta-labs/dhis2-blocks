import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { z } from 'zod'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import {
    PatientList,
    attributeBooleanFilter,
    attributeColumn,
    attributeDateFilter,
    attributeNumberFilter,
    attributeOptionsFilter,
    attributeTextFilter,
    usePatientList,
    type PatientListFilter,
} from '@/components/patient-list'
import { PatientListPlaceholder } from './PatientListPlaceholders'

const ProgramsSchema = z.object({
    programs: z.array(z.object({ id: z.string(), displayName: z.string() })),
})

const AttributeSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    valueType: z.string(),
    optionSet: z
        .object({
            options: z.array(
                z.object({ code: z.string(), displayName: z.string() })
            ),
        })
        .optional(),
})

type Attribute = z.infer<typeof AttributeSchema>

const ProgramAttributesSchema = z.object({
    programTrackedEntityAttributes: z.array(
        z.object({
            displayInList: z.boolean().optional(),
            trackedEntityAttribute: AttributeSchema,
        })
    ),
})

const DEFAULT_PROGRAM = { value: 'IpHINAT79UW', label: 'Child Programme' }

const NUMBER_TYPES = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
    'UNIT_INTERVAL',
])

const TEXT_TYPES = new Set([
    'TEXT',
    'LONG_TEXT',
    'LETTER',
    'EMAIL',
    'PHONE_NUMBER',
    'URL',
    'USERNAME',
])

/** The tracker programs the user can see. */
const usePrograms = () => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['docs', 'tracker-programs'],
        queryFn: async ({ signal }) => {
            const response = await engine.query(
                {
                    programs: {
                        resource: 'programs',
                        params: {
                            filter: 'programType:eq:WITH_REGISTRATION',
                            fields: 'id,displayName',
                            paging: false,
                        },
                    },
                },
                { signal }
            )
            return ProgramsSchema.parse(response.programs).programs
        },
    })
}

/** The program's attributes marked "Display in list". */
const useListAttributes = (program: string) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['docs', 'program-attributes', program],
        queryFn: async ({ signal }) => {
            const response = await engine.query(
                {
                    program: {
                        resource: 'programs',
                        id: program,
                        params: {
                            fields: 'programTrackedEntityAttributes[displayInList,trackedEntityAttribute[id,displayName,valueType,optionSet[options[code,displayName]]]]',
                        },
                    },
                },
                { signal }
            )
            return ProgramAttributesSchema.parse(
                response.program
            ).programTrackedEntityAttributes.flatMap((entry) =>
                entry.displayInList ? [entry.trackedEntityAttribute] : []
            )
        },
    })
}

/** A filter that suits the attribute's value type, or none. */
const filterFor = (
    attribute: Attribute,
    pinned: boolean
): PatientListFilter | undefined => {
    const common = { attribute: attribute.id, label: attribute.displayName }
    if (attribute.optionSet) {
        return attributeOptionsFilter({
            ...common,
            pinned,
            multiple: true,
            options: attribute.optionSet.options.map((option) => ({
                value: option.code,
                label: option.displayName,
            })),
        })
    }
    if (attribute.valueType === 'DATE') {
        return attributeDateFilter({ ...common, pinned })
    }
    if (attribute.valueType === 'BOOLEAN') {
        return attributeBooleanFilter({ ...common, pinned })
    }
    if (NUMBER_TYPES.has(attribute.valueType)) {
        return attributeNumberFilter({ ...common, pinned })
    }
    if (TEXT_TYPES.has(attribute.valueType)) {
        return attributeTextFilter({ ...common, pinned })
    }
    return undefined
}

const ProgramPatients = ({
    program,
    attributes,
}: {
    program: string
    attributes: readonly Attribute[]
}) => {
    // Rebuilt only when the metadata changes, so the list keeps its state.
    const columns = useMemo(
        () =>
            attributes.map((attribute) =>
                attributeColumn(attribute.id, {
                    header: attribute.displayName,
                    format: (value) =>
                        formatDhis2Value(value, attribute, {
                            calendar: 'iso8601',
                        }),
                })
            ),
        [attributes]
    )
    const filters = useMemo(
        () =>
            attributes.flatMap((attribute, index) => {
                const filter = filterFor(attribute, index === 0)
                return filter ? [filter] : []
            }),
        [attributes]
    )
    const list = usePatientList({
        program,
        orgUnit: 'DiszpKrYNg8',
        columns,
        filters,
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    })
    return <PatientList list={list} />
}

const ProgramList = ({ program }: { program: string }) => {
    const attributes = useListAttributes(program)
    if (attributes.isPending) return <PatientListPlaceholder />
    if (attributes.isError) {
        return (
            <p className="text-sm text-dhis2-destructive">
                The program's attributes could not be loaded.
            </p>
        )
    }
    if (attributes.data.length === 0) {
        return (
            <p className="text-sm text-dhis2-muted-foreground">
                This program has no attributes marked "Display in list".
            </p>
        )
    }
    return <ProgramPatients program={program} attributes={attributes.data} />
}

/**
 * The app reads the program's metadata and turns it into columns and
 * filters; the block only lists the rows. Each attribute marked "Display in
 * list" becomes a column, and gets a filter that suits its value type.
 *
 * `IpHINAT79UW` (Child Programme) and `DiszpKrYNg8` (Ngelehun CHC) exist in
 * the DHIS2 Sierra Leone demo database. Replace them with ids from your own
 * instance.
 */
const PatientListFromMetadata = () => {
    const selectId = useId()
    const [program, setProgram] = useState(DEFAULT_PROGRAM.value)
    const programs = usePrograms()
    const items = programs.data?.map((item) => ({
        value: item.id,
        label: item.displayName,
    })) ?? [DEFAULT_PROGRAM]

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <Field className="max-w-sm gap-1">
                <FieldLabel htmlFor={selectId}>Program</FieldLabel>
                <Select
                    items={items}
                    value={program}
                    onValueChange={(next) => {
                        if (next) setProgram(next)
                    }}
                >
                    <SelectTrigger id={selectId}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
            <ProgramList key={program} program={program} />
        </div>
    )
}

export default PatientListFromMetadata

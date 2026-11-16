import { useState } from 'react'
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    useComboboxAnchor,
} from '@/components/dhis2/ui/combobox'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'

const programs = ['Antenatal care', 'Child programme', 'Malaria', 'TB care']

/** Choose several programs, each shown as a chip in the box. */
const ComboboxMultiple = () => {
    const anchor = useComboboxAnchor()
    const [chosen, setChosen] = useState<string[]>(['Malaria'])
    return (
        <Field className="max-w-sm">
            <FieldLabel htmlFor="programs">Programs</FieldLabel>
            <Combobox
                items={programs}
                multiple
                value={chosen}
                onValueChange={setChosen}
            >
                <ComboboxChips ref={anchor}>
                    {chosen.map((program) => (
                        <ComboboxChip
                            key={program}
                            removeLabel={`Remove ${program}`}
                        >
                            {program}
                        </ComboboxChip>
                    ))}
                    <ComboboxChipsInput id="programs" />
                </ComboboxChips>
                <ComboboxContent anchor={anchor}>
                    <ComboboxEmpty>No program matches</ComboboxEmpty>
                    <ComboboxList>
                        {(program: string) => (
                            <ComboboxItem
                                key={program}
                                value={program}
                                indicator="checkbox"
                            >
                                {program}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
        </Field>
    )
}

export default ComboboxMultiple

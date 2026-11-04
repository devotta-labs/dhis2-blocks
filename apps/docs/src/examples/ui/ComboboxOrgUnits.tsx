import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
} from '@/components/dhis2/ui/combobox'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import { selectTriggerVariants } from '@/components/dhis2/ui/select'

const facilities = [
    'Bo Government Hospital',
    'Bumpe CHC',
    'Gbo MCHP',
    'Jembe CHC',
    'Kakua Static',
    'Koribondo CHC',
    'Ngelehun CHC',
    'Njandama MCHP',
    'Sembehun MCHP',
    'Tikonko CHC',
]

/** Pick one facility, or several, by typing part of its name. */
const ComboboxOrgUnits = () => (
    <div className="flex max-w-sm flex-col gap-4">
        <Field>
            <FieldLabel htmlFor="facility">Facility</FieldLabel>
            <Combobox items={facilities}>
                <ComboboxTrigger
                    id="facility"
                    className={selectTriggerVariants()}
                >
                    <span className="min-w-0 flex-1 truncate">
                        <ComboboxValue placeholder="Choose a facility" />
                    </span>
                </ComboboxTrigger>
                <ComboboxContent>
                    <ComboboxInput showTrigger={false} placeholder="Search" />
                    <ComboboxEmpty>No facility matches</ComboboxEmpty>
                    <ComboboxList>
                        {(facility: string) => (
                            <ComboboxItem key={facility} value={facility}>
                                {facility}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
        </Field>
        <Field>
            <FieldLabel htmlFor="facilities">Facilities</FieldLabel>
            <Combobox items={facilities} multiple>
                <ComboboxTrigger
                    id="facilities"
                    className={selectTriggerVariants()}
                >
                    <span className="min-w-0 flex-1 truncate">
                        <ComboboxValue>
                            {(chosen: string[]) =>
                                chosen.length > 0
                                    ? chosen.join(', ')
                                    : 'Choose facilities'
                            }
                        </ComboboxValue>
                    </span>
                </ComboboxTrigger>
                <ComboboxContent>
                    <ComboboxInput showTrigger={false} placeholder="Search" />
                    <ComboboxEmpty>No facility matches</ComboboxEmpty>
                    <ComboboxList>
                        {(facility: string) => (
                            <ComboboxItem
                                key={facility}
                                value={facility}
                                indicator="checkbox"
                            >
                                {facility}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
        </Field>
    </div>
)

export default ComboboxOrgUnits

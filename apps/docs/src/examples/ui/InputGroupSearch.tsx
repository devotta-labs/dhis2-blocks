import { IconCross16, IconSearch16 } from '@dhis2/ui-icons'
import { useRef, useState } from 'react'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupText,
} from '@/components/dhis2/ui/input-group'

/** A search box with an icon and a clear button, and a field with its unit. */
const InputGroupSearch = () => {
    const [search, setSearch] = useState('Kamara')
    const searchInput = useRef<HTMLInputElement>(null)

    return (
        <div className="flex max-w-sm flex-col gap-4">
            <InputGroup>
                <InputGroupAddon>
                    <IconSearch16 />
                </InputGroupAddon>
                <InputGroupInput
                    ref={searchInput}
                    aria-label="Search people"
                    placeholder="Search by name or ID"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            size="icon-xs"
                            aria-label="Clear search"
                            onClick={() => {
                                setSearch('')
                                searchInput.current?.focus()
                            }}
                        >
                            <IconCross16 />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
            <Field>
                <FieldLabel htmlFor="weight">Weight</FieldLabel>
                <InputGroup>
                    <InputGroupInput
                        id="weight"
                        type="number"
                        defaultValue="62"
                    />
                    <InputGroupAddon align="inline-end">
                        <InputGroupText>kg</InputGroupText>
                    </InputGroupAddon>
                </InputGroup>
            </Field>
        </div>
    )
}

export default InputGroupSearch

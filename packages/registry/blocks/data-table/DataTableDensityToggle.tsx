import i18n from '@dhis2/d2-i18n'
import { Button } from '@/components/dhis2/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/dhis2/ui/dropdown-menu'
import { useDataTableView } from './context'
import type { DataTableDensity } from './types'

const densities = (): readonly {
    value: DataTableDensity
    label: string
}[] => [
    { value: 'compact', label: i18n.t('Compact') },
    { value: 'normal', label: i18n.t('Normal') },
    { value: 'comfortable', label: i18n.t('Comfortable') },
]

/** A menu that sets the row density of the table. */
export const DataTableDensityToggle = () => {
    const { density, setDensity } = useDataTableView()
    const options = densities()
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                data-slot="data-table-density"
                render={<Button variant="secondary" size="sm" />}
            >
                {i18n.t('Density')}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuRadioGroup
                    value={density}
                    onValueChange={(value: string) => {
                        const next = options.find(
                            (option) => option.value === value
                        )
                        if (next) setDensity(next.value)
                    }}
                >
                    {options.map((option) => (
                        <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                            closeOnClick
                        >
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

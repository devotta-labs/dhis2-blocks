import { Button } from '@/components/dhis2/ui/button'
import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface ParamField {
    name: string
    label: string
    value: string
}

/** Text fields that write their values to the URL's search params on submit. */
export const ParamsForm = ({
    fields,
    submitLabel,
}: {
    fields: ParamField[]
    submitLabel: string
}) => {
    const [, setSearchParams] = useSearchParams()
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    return (
        <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
                event.preventDefault()
                setSearchParams(
                    Object.fromEntries(
                        fields.map((field) => [
                            field.name,
                            drafts[field.name] ?? field.value,
                        ])
                    )
                )
            }}
        >
            {fields.map((field) => (
                <label
                    key={field.name}
                    className="flex flex-col gap-1 text-sm text-[#4a5768]"
                >
                    {field.label}
                    <input
                        className="h-9 rounded-md border border-[#a0adba] bg-white px-2 text-sm text-[#212934]"
                        value={drafts[field.name] ?? field.value}
                        onChange={(event) =>
                            setDrafts({
                                ...drafts,
                                [field.name]: event.target.value,
                            })
                        }
                    />
                </label>
            ))}
            <Button type="submit">{submitLabel}</Button>
        </form>
    )
}

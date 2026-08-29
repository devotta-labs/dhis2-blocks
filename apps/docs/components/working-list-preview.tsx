const previewPath = '/previews/working-list/basic/index.html'

export function WorkingListPreview() {
    return (
        <iframe
            className="preview-frame block w-full rounded-xl bg-white"
            src={previewPath}
            title="Basic Working List preview"
        />
    )
}

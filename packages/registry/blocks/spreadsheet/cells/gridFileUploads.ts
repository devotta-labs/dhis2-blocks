import i18n from '@dhis2/d2-i18n'
import { createFileUploads } from '@/components/dhis2-value-input'
import type { FileUploads } from '@/components/dhis2-value-input'
import type { CellKey } from '../model/types'
import type { DataEngine, SpreadsheetContext } from '../provider/context'

const running = new Map<string, AbortController>()

const AS_IS = { escapeValue: false }

type UploadContext = Pick<
    SpreadsheetContext,
    'store' | 'effects' | 'fileNames' | 'announce'
> & { engine: DataEngine }

/**
 * The uploads of one editor session in a cell, which outlive the editor: an upload goes on after the editor closes,
 * and then saves its file's id to the cell itself and says how that went. The cell's files learn each uploaded file's
 * name.
 */
export const gridFileUploads: (
    cellKey: CellKey,
    options2: UploadContext
) => FileUploads = (
    cellKey,
    { store, effects, fileNames, announce, engine }
) => {
    const uploads = createFileUploads(engine, running, cellKey, (id, name) =>
        fileNames.setState(({ names }) => ({
            names: new Map(names).set(id, name),
        }))
    )
    let open = 0
    return {
        ...uploads,
        subscribe(listener) {
            open += 1
            const unsubscribe = uploads.subscribe(listener)
            return () => {
                open -= 1
                unsubscribe()
            }
        },
        start(file, image, done, failed) {
            uploads.start(
                file,
                image,
                (id) => {
                    if (open > 0) {
                        done(id)
                        return
                    }
                    announce(
                        store.getState().commit(cellKey, id) === 'queued'
                            ? i18n.t('Uploaded {{file}}', {
                                  file: file.name,
                                  interpolation: AS_IS,
                              })
                            : i18n.t('Not saved: {{reason}}', {
                                  nsSeparator: '::',
                                  reason:
                                      effects.getState().cells[cellKey]
                                          ?.readOnly ?? '',
                                  interpolation: AS_IS,
                              })
                    )
                },
                failed
            )
        },
    }
}

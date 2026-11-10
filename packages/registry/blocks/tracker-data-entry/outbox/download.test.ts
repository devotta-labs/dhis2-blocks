import { unsentChangesCsv } from './download'

test('writes a CSV with a header and quoted values', () => {
    expect(
        unsentChangesCsv([
            {
                form: 'Inpatient',
                row: '2026-10-20',
                field: 'Age',
                value: '4, "x"',
                state: 'failed',
                reason: 'E1302',
            },
        ])
    ).toBe(
        'form,row,field,value,state,reason\nInpatient,2026-10-20,Age,"4, ""x""",failed,E1302\n'
    )
})

test('writes only the header when nothing is unsent', () => {
    expect(unsentChangesCsv([])).toBe('form,row,field,value,state,reason\n')
})

test('quotes values with line breaks and leaves plain ones bare', () => {
    const line = {
        form: 'F',
        row: 'R',
        field: 'Notes',
        value: 'one\ntwo',
        state: 'queued',
        reason: '',
    }
    expect(unsentChangesCsv([line, { ...line, value: 'plain' }])).toBe(
        'form,row,field,value,state,reason\nF,R,Notes,"one\ntwo",queued,\nF,R,Notes,plain,queued,\n'
    )
})

const line = (value: string) => ({
    form: 'F',
    row: 'R',
    field: 'Notes',
    value,
    state: 'queued',
    reason: '',
})
const valueCell = (value: string) =>
    unsentChangesCsv([line(value)])
        .split('\n')[1]
        ?.split(',')[3]

test('defuses a value a spreadsheet would run as a formula', () => {
    expect(valueCell('=1+1')).toBe("'=1+1")
    expect(valueCell('-2+3')).toBe("'-2+3")
    expect(valueCell('+5')).toBe("'+5")
    expect(valueCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(valueCell('\tx')).toBe("'\tx")
})

test('leaves plain numbers, including negative ones, as they are', () => {
    expect(valueCell('-5')).toBe('-5')
    expect(valueCell('-0.5')).toBe('-0.5')
    expect(valueCell('12')).toBe('12')
})

test('defuses before quoting, and in every column but the header', () => {
    expect(unsentChangesCsv([line('=a,b')])).toBe(
        'form,row,field,value,state,reason\nF,R,Notes,"\'=a,b",queued,\n'
    )
    expect(
        unsentChangesCsv([
            { ...line('1'), form: '=F', field: '@f', reason: '-E1302' },
        ])
    ).toBe("form,row,field,value,state,reason\n'=F,R,'@f,1,queued,'-E1302\n")
    expect(unsentChangesCsv([line('\rx')])).toBe(
        'form,row,field,value,state,reason\nF,R,Notes,"\'\rx",queued,\n'
    )
})

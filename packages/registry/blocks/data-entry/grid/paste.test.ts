import type { NavGrid } from './navigation'
import { isBlock, parseBlock, pasteTargets } from './paste'

test('a single value is not a block', () => expect(isBlock('12')).toBe(false))

test('tabs and line breaks make a block', () => {
    expect(isBlock('1\t2')).toBe(true)
    expect(isBlock('1\n2')).toBe(true)
    expect(isBlock('1\r\n2')).toBe(true)
})

test('a single copied cell with its trailing line break is a block of one', () => {
    expect(isBlock('12\r\n')).toBe(true)
    expect(parseBlock('12\r\n')).toEqual([['12']])
})

test('a tab or line break inside quotes does not make a block', () => {
    expect(isBlock('"a\tb"')).toBe(false)
    expect(isBlock('"a\nb"')).toBe(false)
})

test('parses tab-separated rows', () => {
    expect(parseBlock('1\t2\n3\t4')).toEqual([
        ['1', '2'],
        ['3', '4'],
    ])
})

test('splits rows on \\r\\n as well as \\n', () => {
    expect(parseBlock('1\t2\r\n3\t4\r\n')).toEqual([
        ['1', '2'],
        ['3', '4'],
    ])
})

test('ignores one trailing line break but keeps an empty last row', () => {
    expect(parseBlock('1\n2\n')).toEqual([['1'], ['2']])
    expect(parseBlock('1\n\n')).toEqual([['1'], ['']])
})

test('keeps empty cells', () => {
    expect(parseBlock('1\t\t3\t')).toEqual([['1', '', '3', '']])
})

test('keeps ragged rows as they are', () => {
    expect(parseBlock('1\t2\t3\n4\n5\t6')).toEqual([
        ['1', '2', '3'],
        ['4'],
        ['5', '6'],
    ])
})

test('unwraps a quoted field holding a tab or a line break', () => {
    expect(parseBlock('"a\tb"\t"c\r\nd"\n"e"')).toEqual([
        ['a\tb', 'c\r\nd'],
        ['e'],
    ])
})

test('turns "" inside a quoted field into "', () => {
    expect(parseBlock('"say ""hi"""\t"""x"')).toEqual([['say "hi"', '"x']])
})

test('an empty quoted field is an empty cell', () => {
    expect(parseBlock('""\t1')).toEqual([['', '1']])
    expect(parseBlock('1\t""')).toEqual([['1', '']])
})

test('a quote inside an unquoted field is kept as typed', () => {
    expect(parseBlock('5" pipe\t6')).toEqual([['5" pipe', '6']])
})

test('empty text holds no rows', () => expect(parseBlock('')).toEqual([]))

const TABLE = (rows: number, columns: number) => ({
    rows,
    columns,
    isOpen: () => true,
    isEditable: (row: number, column: number) => !(row === 1 && column === 1),
})

test('pastes only into editable cells inside the table', () => {
    const grid: NavGrid = { tables: [TABLE(3, 3)] }
    const block = [
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
        ['g', 'h', 'i'],
    ]
    expect(pasteTargets(grid, { table: 0, row: 2, column: 1 }, block)).toEqual([
        { at: { table: 0, row: 2, column: 1 }, text: 'a' },
        { at: { table: 0, row: 2, column: 2 }, text: 'b' },
    ])
})

test('skips read-only cells without shifting the rest of the block', () => {
    const grid: NavGrid = { tables: [TABLE(3, 3)] }
    const block = [
        ['a', 'b'],
        ['c', 'd'],
    ]
    expect(pasteTargets(grid, { table: 0, row: 0, column: 0 }, block)).toEqual([
        { at: { table: 0, row: 0, column: 0 }, text: 'a' },
        { at: { table: 0, row: 0, column: 1 }, text: 'b' },
        { at: { table: 0, row: 1, column: 0 }, text: 'c' },
    ])
})

test('does not spill into the next table', () => {
    const grid: NavGrid = { tables: [TABLE(1, 2), TABLE(2, 2)] }
    expect(
        pasteTargets(grid, { table: 0, row: 0, column: 1 }, [['a'], ['b']])
    ).toEqual([{ at: { table: 0, row: 0, column: 1 }, text: 'a' }])
})

test('keeps empty cells so they clear what they land on', () => {
    const grid: NavGrid = { tables: [TABLE(1, 3)] }
    expect(
        pasteTargets(grid, { table: 0, row: 0, column: 0 }, [['a', '', 'c']])
    ).toEqual([
        { at: { table: 0, row: 0, column: 0 }, text: 'a' },
        { at: { table: 0, row: 0, column: 1 }, text: '' },
        { at: { table: 0, row: 0, column: 2 }, text: 'c' },
    ])
})

test('pastes a single value into one cell', () => {
    const grid: NavGrid = { tables: [TABLE(2, 2)] }
    expect(
        pasteTargets(grid, { table: 0, row: 1, column: 0 }, [['x']])
    ).toEqual([{ at: { table: 0, row: 1, column: 0 }, text: 'x' }])
})

test('an unterminated quote keeps its text', () => {
    expect(parseBlock('"a\tb\n')).toEqual([['a\tb\n']])
})

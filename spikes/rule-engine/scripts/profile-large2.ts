import * as E from '@dhis2/rule-engine'
import { large } from '../src/large'
import { benchSubset } from '../src/bench'
const rs = large.fx.programRules
const pick = (f: (n: string) => boolean) => new Set(rs.filter((r) => f(r.name)).map((r) => r.id))
console.log('hide only', JSON.stringify(benchSubset(E, large, pick((n) => n.startsWith('hide')), 50)))
console.log('chain only', JSON.stringify(benchSubset(E, large, pick((n) => n.startsWith('chain')), 50)))
console.log('error only', JSON.stringify(benchSubset(E, large, pick((n) => n.startsWith('error')), 50)))
// error rules without validatePattern
const noRegex = { ...large, fx: { ...large.fx, programRules: rs.map((r) => r.name.startsWith('error') ? { ...r, condition: r.condition!.replace(/ \|\| d2:validatePattern.*$/, '') } : r) } }
console.log('error only, no regex', JSON.stringify(benchSubset(E, noRegex, pick((n) => n.startsWith('error')), 50)))
console.log('all, no regex', JSON.stringify(benchSubset(E, noRegex, new Set(rs.map((r) => r.id)), 50)))

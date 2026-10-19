import programRules from '../fixtures/programRules.json'
import programRuleVariables from '../fixtures/programRuleVariables.json'
import constants from '../fixtures/constants.json'
import optionSets from '../fixtures/optionSets.json'
import orgUnit from '../fixtures/orgUnit.json'
import me from '../fixtures/me.json'
import program from '../fixtures/program.json'
import stage from '../fixtures/stage.json'
import enrollment from '../fixtures/enrollment.json'
import { assemble } from './fixtures'

export const rmnch = assemble(
    { programRules, programRuleVariables, constants, optionSets, orgUnit, me, program, stage, enrollment },
    'Evahwp3zrQ4',
)

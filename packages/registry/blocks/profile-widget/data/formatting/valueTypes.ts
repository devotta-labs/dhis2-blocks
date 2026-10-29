import { PROFILE_VALUE_TYPES, type ProfileValueType } from '../../types'

const KNOWN_VALUE_TYPES: ReadonlySet<string> = new Set(PROFILE_VALUE_TYPES)

const isProfileValueType = (valueType: string): valueType is ProfileValueType =>
    KNOWN_VALUE_TYPES.has(valueType)

export const decodeValueType = (valueType: string): ProfileValueType =>
    isProfileValueType(valueType) ? valueType : 'TEXT'

import {describe,it,expect} from 'vitest'
import {
 parseDevicePreferences,shouldPrecacheVideo,DEFAULT_DEVICE_PREFERENCES,
} from './user-playback-preferences'

describe('local device playback preferences',()=>{
 it('rejects malformed or poisoned settings without breaking playback',()=>{
  expect(parseDevicePreferences(null)).toEqual(DEFAULT_DEVICE_PREFERENCES)
  expect(parseDevicePreferences('{"dataSaver":"false","autoPlay":null}')).toEqual(DEFAULT_DEVICE_PREFERENCES)
  expect(parseDevicePreferences('{')).toEqual(DEFAULT_DEVICE_PREFERENCES)
 })
 it('respects user data saver as well as network policy',()=>{
  const p={...DEFAULT_DEVICE_PREFERENCES}
  expect(shouldPrecacheVideo(p,{effectiveType:'4g'})).toBe(true)
  expect(shouldPrecacheVideo({...p,dataSaver:true},{effectiveType:'4g'})).toBe(false)
  expect(shouldPrecacheVideo(p,{saveData:true})).toBe(false)
  expect(shouldPrecacheVideo(p,{effectiveType:'2g'})).toBe(false)
 })
})

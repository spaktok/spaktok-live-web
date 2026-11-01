import {describe,it,expect} from 'vitest'
import {decodeActivityCursor,encodeActivityCursor,sortActivityRows,PAGE_SIZE} from './activity-pagination'
describe('activity feed cursor',()=>{
 it('round trips cursor and preserves timestamp ties',()=>{
  const value={createdAt:'2026-11-01 18:00:00',id:'comment:12345678-1234-1234-1234-123456789abc'}
  expect(decodeActivityCursor(encodeActivityCursor(value))).toEqual(value)
  expect(sortActivityRows([{id:'follow:z',created_at:value.createdAt},{id:'follow:a',created_at:value.createdAt}]).map(x=>x.id)).toEqual(['follow:z','follow:a'])
 })
 it('does not accept invalid or oversized cursors',()=>{
  for(const cursor of ['!', 'a'.repeat(513),Buffer.from('{}').toString('base64url'),
     Buffer.from(JSON.stringify({createdAt:'bad',id:'follow:a'})).toString('base64url'),
     Buffer.from(JSON.stringify({createdAt:'2026-11-01 18:00:00',id:'invalid'})).toString('base64url')])
   expect(decodeActivityCursor(cursor)).toBeUndefined()
  expect(decodeActivityCursor(null)).toBeNull()
 })
 it('caps the page size',()=>expect(PAGE_SIZE).toBe(40))
})

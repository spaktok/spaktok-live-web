import {describe,expect,it} from 'vitest'
import {
 createRealityProject,realityProjectReview,runRealityEvent,
 sampleRealityTrack,validateRealityProject,type RealityProjectV2,
} from './reality-studio-project'
describe('Reality Studio V2 — scene, graph, timeline and review gate',()=>{
 it('builds an editable default project with valid parent structure',()=>{
  const p=createRealityProject()
  expect(()=>validateRealityProject(p)).not.toThrow()
  expect(p.nodes.some(n=>n.kind==='face-morph')).toBe(true)
  expect(realityProjectReview(p).published).toBe(false)
  expect(realityProjectReview(p).canSubmit).toBe(false)
 })
 it('rejects cycles, duplicate nodes, missing targets and unbounded code-like data',()=>{
  const p=createRealityProject()
  expect(()=>validateRealityProject({...p,nodes:[...p.nodes,p.nodes[0]]}))
   .toThrow('reality_project_invalid_node')
  const cycle={...p,nodes:p.nodes.map(n=>n.id==='camera'?{...n,parentId:'face-morph'}:n)}
  expect(()=>validateRealityProject(cycle)).toThrow('reality_project_bad_hierarchy')
  const badGraph={...p,links:[{
   id:'event-1',event:'smile' as const,action:'rotate' as const,
   targetId:'missing',amount:.3,durationMs:300,
  }]}
  expect(()=>validateRealityProject(badGraph)).toThrow('reality_project_invalid_graph')
 })
 it('allows only registered, deterministic event actions and keyframe values',()=>{
  const p=createRealityProject()
  const link={id:'event-1',event:'hand-pinch' as const,
   targetId:'face-morph',action:'rotate' as const,amount:.25,durationMs:400}
  const track={targetId:'face-morph',property:'rotation-z' as const,keyframes:[
   {timeMs:0,value:0},{timeMs:500,value:.6},{timeMs:1000,value:0},
  ]}
  const project:RealityProjectV2={...p,links:[link],timeline:[track]}
  validateRealityProject(project)
  expect(runRealityEvent(project,'hand-pinch')).toHaveLength(1)
  expect(runRealityEvent(project,'smile')).toHaveLength(0)
  expect(sampleRealityTrack(track,0)).toBeCloseTo(0)
  expect(sampleRealityTrack(track,500)).toBeCloseTo(.6)
  expect(sampleRealityTrack(track,1000)).toBeCloseTo(0)
  expect(sampleRealityTrack(track,250)).toBeGreaterThan(0)
 })
 it('blocks review submission without rights and never authorizes publication',()=>{
  const p=createRealityProject()
  expect(()=>validateRealityProject({...p,review:'submitted'}))
   .toThrow('reality_project_rights_required')
  const licensed={...p,rights:'licensed' as const,review:'submitted' as const}
  expect(()=>validateRealityProject(licensed)).not.toThrow()
  expect(realityProjectReview(licensed).warnings).toContain('no_approved_asset_distribution')
  expect(realityProjectReview(licensed).published).toBe(false)
 })
})

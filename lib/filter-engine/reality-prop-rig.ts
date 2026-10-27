/** Shared, bounded secondary rig targets for real GLB articulation.
 * Authors can name pivot groups SpakTokTempleLeft/Right and
 * SpakTokHairLock*; the runtime animates those groups only if they exist.
 * This is NOT a cloth/hair solver: compliant authored rigs required.
 */
export type RigState='mounted'|'grabbed'|'returning'
export type RigActuation=Readonly<{
 leftTempleY:number
 rightTempleY:number
 hairRollZ:number
 hairPitchX:number
}>
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
export function realityRigActuation(
 state:RigState,
 hand:'Left'|'Right'|'Unknown'|null,
 rotationDelta:Readonly<{pitch:number;roll:number}>,
):RigActuation{
 if(!Number.isFinite(rotationDelta.pitch)||!Number.isFinite(rotationDelta.roll))
  return {leftTempleY:0,rightTempleY:0,hairRollZ:0,hairPitchX:0}
 if(state!=='grabbed')return {leftTempleY:0,rightTempleY:0,hairRollZ:0,hairPitchX:0}
 const left=hand==='Left' ? .28 : .11,right=hand==='Right' ? .28 : .11
 return {
  leftTempleY:clamp(left+rotationDelta.roll*.12,-.1,.4),
  rightTempleY:-clamp(right-rotationDelta.roll*.12,-.4,.4),
  hairRollZ:clamp(rotationDelta.roll*.36,-.28,.28),
  hairPitchX:clamp(rotationDelta.pitch*.25,-.24,.24),
 }
}

import{describe,it,expect}from'vitest'
import{estimateAmbientLight,adaptiveJewelryLight}from'./lighting3d'
function pixels(r:number,g:number,b:number,width=24,height=16){
 const data=new Uint8ClampedArray(width*height*4)
 for(let i=0;i<data.length;i+=4){data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255}
 return data
}
describe('adaptive camera-matched 3D jewelry lighting',()=>{
 it('reacts to actual ambient brightness without an expensive full-resolution readback',()=>{
  expect(estimateAmbientLight(pixels(240,240,240),24,16).brightness)
   .toBeGreaterThan(estimateAmbientLight(pixels(25,25,25),24,16).brightness)
 })
 it('measures warm/cool lighting while respecting physical bounds',()=>{
  expect(estimateAmbientLight(pixels(220,170,70),24,16).warmth).toBeGreaterThan(0)
  expect(estimateAmbientLight(pixels(80,150,220),24,16).warmth).toBeLessThan(0)
 })
 it('estimates light direction from brighter half of frame',()=>{
  const frame=pixels(20,20,20)
  for(let y=0;y<16;y++)for(let x=0;x<12;x++){
   const i=(y*24+x)*4
   frame[i]=frame[i+1]=frame[i+2]=240
  }
  expect(estimateAmbientLight(frame,24,16).side).toBeGreaterThan(.25)
 })
 it('fails safely with invalid frames',()=>{
  expect(estimateAmbientLight(new Uint8ClampedArray(),24,16).brightness).toBe(.55)
 })
})

describe('bounded 3D illumination',()=>{
 it('responds to scene brightness without exceeding light intensity limits',()=>{
  const dark=adaptiveJewelryLight({brightness:.08,warmth:0,side:0})
  const bright=adaptiveJewelryLight({brightness:.8,warmth:0,side:0})
  expect(bright.key).toBeGreaterThan(dark.key)
  expect(bright.fill).toBeGreaterThan(dark.fill)
  expect(bright.key).toBeLessThanOrEqual(3.1)
 })
 it('reacts gently to side lighting and warm/cold camera tones',()=>{
  const warm=adaptiveJewelryLight({brightness:.5,warmth:.32,side:.6})
  const cool=adaptiveJewelryLight({brightness:.5,warmth:-.32,side:-.6})
  expect(warm.blue).toBeLessThan(cool.blue)
  expect(warm.horizontalOffset).toBeGreaterThan(0)
  expect(cool.horizontalOffset).toBeLessThan(0)
 })
})

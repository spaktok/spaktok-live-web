/**
 * Import only self-contained SVG artwork exported by a vector authoring tool.
 * The SVG remains visually unchanged; unsafe or externally-linked SVGs are
 * rejected rather than edited, fetched, or injected into the DOM.
 */
export const MAX_VECTOR_BYTES = 1_500_000
const ALLOWED_TAGS=new Set([
 'svg','g','path','defs','linearGradient','radialGradient','stop','clipPath',
 'mask','rect','circle','ellipse','line','polyline','polygon','text','tspan',
 'filter','feGaussianBlur','feOffset','feColorMatrix','feBlend','feComposite',
 'feFlood','feMerge','feMergeNode','feDropShadow','pattern','symbol','use','style',
 'title','desc',
].map(x=>x.toLowerCase()))
const ALLOWED_NAMESPACE='http://www.w3.org/2000/svg'
function unsafeCss(value:string):boolean{
 if(/@import\b|@font-face\b|expression\s*\(|behavior\s*:|-moz-binding/i.test(value))return true
 if(!/url\s*\(/i.test(value))return false
 const urls=[...value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi)]
 // Allow only local SVG gradients, masks and clip-path references.
 if(!urls.length)return true
 return urls.some(match=>!/^#[A-Za-z_][A-Za-z0-9_.:-]*$/.test(match[2].trim()))
}

export function validateSelfContainedSvg(text:string):void{
 if(!text||new TextEncoder().encode(text).byteLength>MAX_VECTOR_BYTES)throw new Error('vector_size')
 if(/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(text))throw new Error('vector_external_xml')
 if(typeof DOMParser==='undefined')throw new Error('vector_browser_only')
 const xml=new DOMParser().parseFromString(text,'image/svg+xml')
 const root=xml.documentElement
 if(root.localName!=='svg'||root.namespaceURI!==ALLOWED_NAMESPACE||xml.querySelector('parsererror'))
  throw new Error('vector_invalid_svg')
 const tags=[root,...Array.from(root.getElementsByTagName('*'))]
 if(tags.length>12000)throw new Error('vector_complexity')
 for(const el of tags){
  if(el.namespaceURI!==ALLOWED_NAMESPACE||!ALLOWED_TAGS.has(el.localName.toLowerCase()))
    throw new Error('vector_unsafe_element')
  if(el.localName.toLowerCase()==='style'&&unsafeCss(el.textContent||''))
    throw new Error('vector_external_style')
  for(const attr of Array.from(el.attributes)){
   const key=attr.localName.toLowerCase(),value=attr.value.trim()
   if(key.startsWith('on')||key==='src'||key==='srcset')throw new Error('vector_unsafe_attribute')
   if(key==='href'&&value&&!/^#[A-Za-z0-9_.:-]+$/.test(value))
     throw new Error('vector_external_link')
   if((key==='style'||value.includes('url('))&&unsafeCss(value))
     throw new Error('vector_external_style')
   if(key==='filter'&&value.includes('url(')&&unsafeCss(value))
     throw new Error('vector_external_filter')
  }
 }
}
export function vectorLayout(x:number,y:number,size:number,w:number,h:number,ratio:number){
 const targetW=w*Math.max(.05,Math.min(.85,size/100))
 const targetH=targetW/Math.max(.01,Math.min(100,ratio))
 const maximumH=h*.6
 const fit=Math.min(1,maximumH/targetH)
 return {left:w*x/100-targetW*fit/2,top:h*y/100-targetH*fit/2,
   width:targetW*fit,height:targetH*fit}
}

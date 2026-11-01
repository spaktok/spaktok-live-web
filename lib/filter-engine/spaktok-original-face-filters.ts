/** Spaktok-owned original PBR face finishes, not copied TikTok assets.
 * All looks share one already-tracked 478-point face mesh, one shader,
 * one 256x256 static microtexture and one local camera light estimate.
 * This pack has ZERO network-fetched photos or models.
 * Performance on a real Android device still requires QA.
 */
export type OriginalFacePbrFinish=Readonly<{
 id:`3d-premium-${string}`
 name:string
 icon:string
 base:number;accent:number;accentAmount:number
 metalness:number;roughness:number;clearcoat:number;subsurface:number
 opacity:number
}>
export const SPAKTOK_ORIGINAL_FACE_FINISHES=[
 {id:'3d-premium-platinum',name:'بلاتين فاخر',icon:'🪞',
  base:0xb5c4d1,accent:0xf0ebea,accentAmount:.28,
  metalness:.80,roughness:.30,clearcoat:.37,subsurface:0,opacity:.69},
 {id:'3d-premium-royal-gold',name:'ذهب ملكي',icon:'🥇',
  base:0xd8ad67,accent:0xffdba3,accentAmount:.24,
  metalness:.82,roughness:.36,clearcoat:.38,subsurface:0,opacity:.67},
 {id:'3d-premium-rose-gold',name:'ذهب وردي',icon:'🌹',
  base:0xc99797,accent:0xf1d0ca,accentAmount:.35,
  metalness:.72,roughness:.33,clearcoat:.43,subsurface:0,opacity:.64},
 {id:'3d-premium-silk-pearl',name:'لؤلؤ حريري',icon:'🦪',
  base:0xe7deda,accent:0xfff6ec,accentAmount:.15,
  metalness:.05,roughness:.38,clearcoat:.67,subsurface:.22,opacity:.61},
 {id:'3d-premium-sapphire',name:'ياقوت أزرق',icon:'💠',
  base:0x4777ad,accent:0xa4c9e9,accentAmount:.32,
  metalness:.38,roughness:.29,clearcoat:.66,subsurface:.04,opacity:.70},
 {id:'3d-premium-emerald',name:'زمرد',icon:'💚',
  base:0x4c927d,accent:0x9fd4ac,accentAmount:.32,
  metalness:.36,roughness:.32,clearcoat:.70,subsurface:.05,opacity:.69},
 {id:'3d-premium-ruby',name:'ياقوت أحمر',icon:'❤️',
  base:0xb96275,accent:0xf3b1a2,accentAmount:.29,
  metalness:.35,roughness:.34,clearcoat:.69,subsurface:.07,opacity:.66},
 {id:'3d-premium-obsidian',name:'أوبسيديان لامع',icon:'🖤',
  base:0x626d78,accent:0xadb6c3,accentAmount:.38,
  metalness:.57,roughness:.29,clearcoat:.71,subsurface:0,opacity:.59},
 {id:'3d-premium-bronze',name:'برونز مصقول',icon:'🏺',
  base:0xaf8364,accent:0xd6ab82,accentAmount:.31,
  metalness:.78,roughness:.41,clearcoat:.38,subsurface:0,opacity:.65},
 {id:'3d-premium-opal',name:'أوبال مضيء',icon:'🌈',
  base:0xbed5d9,accent:0xc4b6dc,accentAmount:.43,
  metalness:.07,roughness:.33,clearcoat:.80,subsurface:.14,opacity:.63},
 {id:'3d-premium-champagne',name:'شمبانيا ساتان',icon:'🌟',
  base:0xd6c29f,accent:0xf1e1ca,accentAmount:.27,
  metalness:.43,roughness:.42,clearcoat:.55,subsurface:.07,opacity:.62},
 {id:'3d-premium-ice',name:'كريستال جليدي',icon:'❄️',
  base:0xc7e4ef,accent:0xe6fbff,accentAmount:.36,
  metalness:.12,roughness:.29,clearcoat:.86,subsurface:.03,opacity:.62},
  // 2026 face-surface pack: genuine tracked-mesh shader finishes, not GLB crowns.
  {id:'3d-premium-moonstone',name:'حجر القمر',icon:'🌙',
  base:0xc8d8e8,accent:0xf1e0fb,accentAmount:.38,
  metalness:.12,roughness:.35,clearcoat:.78,subsurface:.13,opacity:.62},
 {id:'3d-premium-black-diamond',name:'ألماس أسود',icon:'💎',
  base:0x30394a,accent:0x8b9bab,accentAmount:.3,
  metalness:.56,roughness:.19,clearcoat:.89,subsurface:0,opacity:.67},
 {id:'3d-premium-azure-chrome',name:'كروم أزرق',icon:'🩵',
  base:0x527dbe,accent:0xb2e0fa,accentAmount:.32,
  metalness:.87,roughness:.22,clearcoat:.72,subsurface:0,opacity:.68},
 {id:'3d-premium-lavender-pearl',name:'لؤلؤ بنفسجي',icon:'🪻',
  base:0xc2a5cf,accent:0xf4d9f2,accentAmount:.28,
  metalness:.09,roughness:.38,clearcoat:.69,subsurface:.2,opacity:.62},
 {id:'3d-premium-sunset-copper',name:'نحاس الغروب',icon:'🌅',
  base:0xb97252,accent:0xf2ba85,accentAmount:.35,
  metalness:.75,roughness:.33,clearcoat:.53,subsurface:0,opacity:.66},
 {id:'3d-premium-jade',name:'يشم فاخر',icon:'🍃',
  base:0x538d70,accent:0xb4dba9,accentAmount:.27,
  metalness:.03,roughness:.36,clearcoat:.66,subsurface:.16,opacity:.65},
 {id:'3d-premium-rose-quartz',name:'كوارتز وردي',icon:'🩷',
  base:0xd7a3b1,accent:0xffe1d9,accentAmount:.26,
  metalness:.02,roughness:.35,clearcoat:.76,subsurface:.15,opacity:.59},
 {id:'3d-premium-arctic-glass',name:'زجاج قطبي',icon:'🧊',
  base:0x9ad4e1,accent:0xe5fdff,accentAmount:.39,
  metalness:.06,roughness:.15,clearcoat:.94,subsurface:.04,opacity:.54},
] as const satisfies readonly OriginalFacePbrFinish[]

const byId=new Map<string,OriginalFacePbrFinish>(
 SPAKTOK_ORIGINAL_FACE_FINISHES.map(look=>[look.id,look]),
)
if(byId.size!==SPAKTOK_ORIGINAL_FACE_FINISHES.length)
 throw Error('spaktok_duplicate_original_filter_id')

export function getOriginalFaceFinish(id:string):OriginalFacePbrFinish|null{
 return byId.get(id)??null
}
export function isOriginalFaceFinishId(id:string):boolean{
 return byId.has(id)
}
/** Emphasize the difference between packaged ready-to-render shaders and
 * 3D GLB downloads needing an explicit rights and device QA gate.
 */
export const SPAKTOK_ORIGINAL_PACK_INFO=Object.freeze({
 version:1,
 license:'Spaktok-original',
 delivery:'bundled-shader' as const,
 remoteGlbDownloads:0,
 addedFilters:SPAKTOK_ORIGINAL_FACE_FINISHES.length,
 deviceCertified:false,
})

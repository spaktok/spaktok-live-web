import * as THREE from 'three'

/** Mobile-friendly reference-inspired SpakTok LUXA preview heads.
 * Stylized procedural geometry; these are NOT reconstructions of images or
 * production scan-quality digital humans. Source images remain design guides.
 */
export type LuxeAvatarStyle='masculine'|'feminine'
export type LuxeAvatarPreset=Readonly<{
 id:LuxeAvatarStyle;label:string
 hair:string;eye:string;makeup:string;finish:string
 description:string
}>
export const LUXE_AVATAR_PRESETS:ReadonlyArray<LuxeAvatarPreset>=[
 {id:'masculine',label:'LUXA • ذكوري',hair:'Jet black sculpted quiff',
  eye:'Icy blue glass iris',makeup:'Soft natural contrast',
  finish:'Luminous skin and defined angular jaw',
  description:'فك محدد وشعر أسود متموّج وعيون زرقاء وخامة جلد مصقولة'},
 {id:'feminine',label:'LUXA • أنثوي',hair:'Gloss black sculpted waves',
  eye:'Bright turquoise glass iris',makeup:'Iridescent violet-blue eye makeup',
  finish:'Glazed pearl skin and sculpted soft jaw',
  description:'عينان فيروزيتان ورموش بارزة ومكياج لؤلؤي وشعر لامع'},
]
export type LuxeAvatarRig=Readonly<{
 root:THREE.Group
 eyes:readonly THREE.Object3D[]
 brows:readonly THREE.Object3D[]
 mouth:THREE.Group
}>
const P=Math.PI
const vector=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
const sphere=(r=1,s=24,t=16)=>new THREE.SphereGeometry(r,s,t)
const material=(color:number,roughness=.36,coat=.45)=>
 new THREE.MeshPhysicalMaterial({color,metalness:.025,roughness,
  clearcoat:coat,clearcoatRoughness:.2})
const hairMat=new THREE.MeshPhysicalMaterial({color:0x090b16,roughness:.22,
 metalness:.23,clearcoat:1,clearcoatRoughness:.11})
const hairGlint=new THREE.MeshPhysicalMaterial({color:0x334155,roughness:.19,
 metalness:.45,clearcoat:1,clearcoatRoughness:.08})
/** Features are enclosed in a reusable bone-like Group and animated through
 * the existing camera expression mapping. All geometry is on-device.
 */
export function createLuxeAvatar(style:LuxeAvatarStyle):LuxeAvatarRig{
 if(style!=='masculine'&&style!=='feminine')throw Error('invalid_luxe_style')
 const fem=style==='feminine'
 const root=new THREE.Group()
 const skin=material(fem?0xe8b2a2:0xdba48d,fem ? .24 : .31,fem ? .85 : .65)
 const skinShade=material(fem?0xd69b91:0xc98d76,.45,.2)
 const lip=material(fem?0xe67e95:0xb86e78,.26,.85)
 const lipShadow=material(fem?0x9b465b:0x914c51,.37,.4)
 const ink=material(0x101521,.3,.15)
 const eyeWhite=material(0xf5f7fb,.15,.3)
 const iris=material(fem?0x12c9dc:0x258cc4,.15,1)
 const irisOuter=material(fem?0x0b566b:0x153e69,.25,.6)
 const sparkle=new THREE.MeshBasicMaterial({color:0xffffff})
 const violet=material(0xa25fe6,.27,.86)
 const cyan=material(0x37d4f0,.24,.9)
 const blush=material(0xd98ba2,.55,.5)
 const add=(parent:THREE.Object3D,geo:THREE.BufferGeometry,
  mat:THREE.Material,x:number,y:number,z:number,
  sx=1,sy=1,sz=1)=>{
  const part=new THREE.Mesh(geo,mat)
  part.position.set(x,y,z)
  part.scale.set(sx,sy,sz);parent.add(part)
  return part
 }
 const curve=(parent:THREE.Object3D,points:THREE.Vector3[],
  radius:number,mat:THREE.Material,segments=14)=>{
  const bezier=new THREE.CatmullRomCurve3(points)
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(bezier,segments,radius,5,false),mat)
  parent.add(mesh);return mesh
 }
 // Parametric head: its lower cheek/jaw width differs between presets,
 // instead of scaling an identical sphere. Dense enough to remain smooth
 // under rotation without excessive phone GPU cost.
 const rings=42,around=62,positions:number[]=[],uvs:number[]=[],faces:number[]=[]
 const width=fem ? .76 : .84,height=fem ? 1.04 : 1.12
 for(let j=0;j<=rings;j++){
  const theta=P*j/rings
  const y=Math.cos(theta)*height
  const r=Math.max(.001,Math.sin(theta))
  const jaw=Math.max(0,-y)/height
  const angular=fem?1-.26*jaw*jaw:1-.11*jaw
  for(let i=0;i<=around;i++){
   const phi=2*P*i/around
   const x=Math.cos(phi)*r*width*angular
   // Subtle cheekbone highpoints and a less protruding chin.
   const cheek=1+.07*Math.exp(-Math.pow((y+.08)/.37,2))
   const z=Math.sin(phi)*r*.72*cheek
   positions.push(x,y,z)
   uvs.push(i/around,1-j/rings)
  }
 }
 for(let y=0;y<rings;y++)for(let x=0;x<around;x++){
  const a=y*(around+1)+x,b=a+around+1
  faces.push(a,a+1,b,b,a+1,b+1)
 }
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
 geometry.setIndex(faces);geometry.computeVertexNormals()
 add(root,geometry,skin,0,0,0)
 // Bare neck/ears; smooth soft highlights and small inner-ear contour.
 add(root,sphere(1,26,18),skin,0,-1.03,-.09,.37,.54,.37)
 for(const side of [-1,1]){
  const earX=side*(fem?.73:.81)
  add(root,sphere(.28,20,14),skin,earX,-.07,-.015,.46,1.12,.47)
  add(root,sphere(.17,18,12),skinShade,earX+side*.075,-.11,.12,.44,.92,.18)
  if(fem){
   const hoop=new THREE.Mesh(
    new THREE.TorusGeometry(.105,.015,7,30),
    material(0xd8c4ea,.13,1))
   hoop.position.set(earX+side*.035,-.42,.13)
   root.add(hoop)
  }
 }
 const eyes:THREE.Object3D[]=[]
 const brows:THREE.Object3D[]=[]
 const eyeY=fem?.19:.18,eyeX=fem?.315:.315
 for(const side of [-1,1]){
  const x=side*eyeX
  add(root,sphere(.2,20,14),skinShade,x,eyeY,.615,.94,.78,.30)
  // Fem style has a low-cost iridescent two-band eye shadow.
  if(fem){
   add(root,sphere(.19,24,14),violet,x,eyeY+.065,.716,1.21,.64,.27)
   add(root,sphere(.17,20,12),cyan,x,eyeY+.054,.743,.78,.28,.11)
  }
  const eyeRig=new THREE.Group()
  eyeRig.position.set(x,eyeY,.746)
  root.add(eyeRig);eyes.push(eyeRig)
  add(eyeRig,sphere(.16,26,18),eyeWhite,0,0,0,1.16,.74,.42)
  add(eyeRig,sphere(.1,24,16),iris,0,.005,.081,.80,.91,.27)
  add(eyeRig,sphere(.064,20,12),irisOuter,0,.005,.104,.85,.85,.19)
  add(eyeRig,sphere(.041,16,10),ink,0,.005,.119,.89,.92,.15)
  add(eyeRig,sphere(.023,12,8),sparkle,-.026,.03,.139,.45,.7,.25)
  // Eyelid silhouette, lash wing and more defined brow arc.
  const start=x-side*.2,end=x+side*.21
  curve(root,[
   vector(start,eyeY+.018,.758),
   vector(x-side*.07,eyeY+.092,.795),
   vector(x+side*.07,eyeY+.10,.8),
   vector(end,eyeY+.04,.754),
   vector(end+side*(fem?.075:.01),eyeY+(fem?.125:.05),.725),
  ],fem?.020:.013,ink,18)
  if(fem){
   for(let k=0;k<5;k++){
    const x1=x+side*(.09+k*.026)
    curve(root,[
     vector(x1,eyeY+.06,.787),
     vector(x1+side*.022,eyeY+.115,.79),
     vector(x1+side*.03,eyeY+.145+k*.008,.765),
    ],.0065,ink,7)
   }
  }
  const eyebrow=new THREE.Group()
  eyebrow.position.set(x,eyeY+.295,.64)
  eyebrow.userData.restY=eyeY+.295
  root.add(eyebrow);brows.push(eyebrow)
  curve(eyebrow,[
   vector(-.18,-.028,0),vector(-.055,.047,.045),
   vector(.08,.07,.058),vector(.19,.01,-.018),
  ].map(p=>vector(p.x*side,p.y,p.z)),fem?.025:.037,ink,18)
 }
 // Short sculpted nose, nostrils, upper bridge.
 add(root,sphere(.19,24,16),skin,0,-.065,.66,.64,1.37,.80)
 add(root,sphere(.17,22,14),skin,0,-.215,.76,1.05,.74,.67)
 for(const x of [-.105,.105])
  add(root,sphere(.065,14,10),skinShade,x,-.27,.795,.75,.25,.32)
 const mouth=new THREE.Group()
 mouth.position.set(0,fem?-.49:-.54,.69)
 root.add(mouth)
 add(mouth,sphere(.27,28,16),lipShadow,0,-.016,0,1,.17,.18)
 add(mouth,sphere(.27,28,16),lip,0,.031,.029,1.05,.36,.31)
 add(mouth,sphere(.26,28,16),lip,0,-.061,.045,.96,.27,.31)
 add(mouth,sphere(.11,18,10),material(0xffdce4,.18,.7),-.055,-.04,.125,.7,.10,.16)
 if(fem){
  for(const x of [-.44,.44])
   add(root,sphere(.2,18,12),blush,x,-.18,.56,.78,.43,.065)
 }
 // Head cap and separately curved hairstyle ribs. Kept intentionally
 // editable, unlike the example image that cannot be converted to geometry
 // without a trained reconstruction step.
 add(root,sphere(1,36,24),hairMat,0,.82,-.08,.80,.37,.67)
 add(root,sphere(1,26,18),hairMat,0,.66,-.34,.82,.44,.41)
 const hair=new THREE.Group();root.add(hair)
 // Directional wave lines originate near forehead and sweep toward the
 // crown and side. Each curve is a full 3D tube (not a painted screenshot).
 for(let i=0;i<22;i++){
  const t=i/21
  const fromX=-.73+t*1.44
  const rootY=.70+(.28*(1-Math.abs(t-.5)*1.55))
  const frontZ=.53+.17*Math.sin(P*t)
  const points=[
   vector(fromX,rootY,frontZ),
   vector(fromX+(.22-.15*t),1.03+.11*Math.sin(P*t),.47),
   vector(fromX+.25,1.27+.10*Math.sin(P*t),.17),
   vector(fromX+.15,1.21,-.24),
   vector(fromX-.05,1.0,-.52),
  ]
  curve(hair,points,fem?.057:.06,hairMat,16)
  if(i%2===0){
   const glintPoints=points.map(p=>p.clone().add(vector(.006,.016,.035)))
   curve(hair,glintPoints,.0065,hairGlint,16)
  }
 }
 // Curved front forelock styled from the reference for both looks.
 const curl=[
  vector(-.45,1.09,.48),vector(-.65,.99,.66),
  vector(-.69,.76,.75),vector(-.51,.64,.80),vector(-.43,.81,.84),
 ]
 curve(hair,curl,fem?.099:.095,hairMat,23)
 curve(hair,curl.map(p=>p.clone().add(vector(-.025,.018,.057))),
  .008,hairGlint,23)
 // Fine lower-face stubble; one draw call via InstancedMesh, not one mesh
 // per hair follicle. No stubble on the feminine style.
 if(!fem){
  const stubble=new THREE.InstancedMesh(
   new THREE.SphereGeometry(.0055,5,4),
   material(0x63493d,.7,.05),210)
  const dummy=new THREE.Object3D()
  for(let i=0;i<210;i++){
   const angle=(i*2.399963229728653)%(2*P)
   const r=Math.sqrt((i+.5)/210)
   const x=Math.cos(angle)*r*.63
   const y=-.49-Math.sin(angle)*r*.38
   const ellipse=(x/.85)**2+(y/1.12)**2
   const z=Math.sqrt(Math.max(0,1-ellipse))*.72+.012
   dummy.position.set(x,y,z)
   dummy.scale.setScalar(.7+(i%4)*.22)
   dummy.updateMatrix();stubble.setMatrixAt(i,dummy.matrix)
  }
  stubble.instanceMatrix.needsUpdate=true
  root.add(stubble)
 }
 return {root,eyes,brows,mouth}
}

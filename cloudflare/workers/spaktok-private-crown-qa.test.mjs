import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{auditGlb} from './spaktok-private-crown-qa.mjs';

const SIZE=4856516;
function fakeGlb({normals=true,uv=true,external=false,triangles=30000}={}){
 const doc={asset:{version:'2.0'},
  accessors:[{count:triangles*3}],
  meshes:[{primitives:[{indices:0,attributes:{
   POSITION:0,...(normals?{NORMAL:0}:{}),...(uv?{TEXCOORD_0:0}:{})}}]}],
  materials:[{name:'material_0',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}],
  images:[{bufferView:0,mimeType:'image/png'}],
  buffers:[external?{uri:'http://outside.example/buffer.bin'}:{byteLength:4}],
 };
 const json=new TextEncoder().encode(JSON.stringify(doc));
 const padded=(json.length+3)&~3;
 const buffer=new ArrayBuffer(SIZE),view=new DataView(buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);
 view.setUint32(8,SIZE,true);view.setUint32(12,padded,true);
 view.setUint32(16,0x4e4f534a,true);
 new Uint8Array(buffer,20,json.length).set(json);
 new Uint8Array(buffer,20+json.length,padded-json.length).fill(32);
 return buffer;
}

test('private audit counts real triangles, UVs and normal accessors',()=>{
 const r=auditGlb(fakeGlb());
 assert.equal(r.triangles,30000);
 assert.equal(r.pbrMaterialCount,1);
 assert.equal(r.mobileStructuralPass,true);
 assert.equal(r.livePublished,false);
 assert.equal(r.referenceMatchVerified,false);
});
test('missing normals or external buffers prevent mobile pass',()=>{
 assert.equal(auditGlb(fakeGlb({normals:false})).mobileStructuralPass,false);
 assert.equal(auditGlb(fakeGlb({external:true})).mobileStructuralPass,false);
});
test('corrupted GLB header is rejected',()=>{
 const glb=fakeGlb();new DataView(glb).setUint32(0,0,true);
 assert.throws(()=>auditGlb(glb),/invalid_glb_header/);
});
test('public routes do not reveal owner GLB or audit data',async()=>{
 const response=await worker.fetch(new Request('https://private.example/v1/owner/royal-crown-01/download'),
   {VAST_ASSETS:{get(){throw Error('must not read private bucket')}}});
 assert.equal(response.status,404);
 const health=await worker.fetch(new Request('https://private.example/health'),{});
 assert.equal(health.status,200);
 const json=await health.json();
 assert.equal(json.publicModelAccess,false);
});

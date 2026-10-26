#!/usr/bin/env python3
"""Build original detailed royal-couture crown model as a PBR glTF Binary.
Coordinates match SpakTok FaceMesh3DEngine: forehead base y=-0.55,
front of the face toward positive z, upper crown toward negative y.
No external mesh/model is downloaded, no user face data is used.
"""
import math
from collections import defaultdict
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

output = Path(__file__).resolve().parents[1] / 'public' / 'face-assets' / 'spaktok-royal-couture.glb'
material_colors = {
    'rose_gold': ((222, 144, 116, 255), .93, .18),
    'champagne': ((248, 191, 132, 255), .91, .16),
    'silver': ((191, 218, 239, 255), .89, .21),
    'dark_gold': ((136, 74, 58, 255), .90, .29),
    'diamond': ((231, 248, 255, 255), .02, .07),
    'opal_pink': ((236, 86, 223, 255), .02, .075),
    'opal_blue': ((65, 176, 255, 255), .02, .065),
    'opal_violet': ((149, 89, 247, 255), .02, .06),
    'opal_gold': ((255, 204, 94, 255), .02, .08),
    'opal_cyan': ((48, 225, 225, 255), .02, .07),
}
groups = defaultdict(list)

def push(mesh, material):
    if len(mesh.vertices) and len(mesh.faces):
        groups[material].append(mesh)

def tube(points, radius, material, sides=8, closed=False):
    samples = np.asarray(points, dtype=float)
    if closed:
        samples = np.vstack((samples, samples[0]))
    if len(samples)>15: samples = np.vstack((samples[::2],samples[-1]))
    lengths = np.linalg.norm(np.diff(samples, axis=0), axis=1)
    if len(lengths) == 0 or lengths.sum() < 1e-5:
        return
    # Tangents from the sampled smooth path.
    tangents = np.zeros_like(samples)
    tangents[0] = samples[1] - samples[0]
    tangents[-1] = samples[-1] - samples[-2]
    tangents[1:-1] = samples[2:] - samples[:-2]
    tangents /= np.maximum(np.linalg.norm(tangents, axis=1, keepdims=True), 1e-9)
    vertices = []
    for p, axis in zip(samples, tangents):
        up = np.array([0., 0., 1.])
        if abs(np.dot(up, axis)) > .95:
            up = np.array([0., 1., 0.])
        basis = np.cross(axis, up)
        basis /= max(np.linalg.norm(basis), 1e-9)
        cross = np.cross(axis, basis)
        for k in range(sides):
            angle = 2 * math.pi * k / sides
            vertices.append(p + radius * (math.cos(angle)*basis + math.sin(angle)*cross))
    faces = []
    for index in range(len(samples)-1):
        for k in range(sides):
            a = index*sides+k
            b = index*sides+(k+1) % sides
            c = (index+1)*sides+k
            d = (index+1)*sides+(k+1) % sides
            faces.extend(((a,c,b),(b,c,d)))
    push(trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces),process=False),material)

def curve(control, radius, material, steps=45, sides=8):
    p = np.asarray(control,dtype=float)
    sampled = []
    # Catmull-Rom passes through the control points and creates filigree.
    for i in range(len(p)-1):
        a=p[max(0,i-1)];b=p[i];c=p[i+1];d=p[min(len(p)-1,i+2)]
        for t in np.linspace(0,1,max(3,steps//(len(p)-1)),endpoint=False):
            t2=t*t;t3=t2*t
            sampled.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3))
    sampled.append(p[-1]);tube(sampled,radius,material,sides)

def spiral(x,y,z,radius,side,material='champagne',turns=1.7):
    pts=[]
    for i in range(48):
        t=i/47
        a=2*math.pi*turns*t+.4
        r=radius*(1-.88*t)
        pts.append([x+side*r*math.cos(a),y+r*math.sin(a),z+.018*math.sin(a)])
    tube(pts,.0065,material)

def rounded_ring(x,y,z,rx,ry,radius,material):
    pts=[[x+rx*math.cos(2*math.pi*i/60),y+ry*math.sin(2*math.pi*i/60),z] for i in range(61)]
    tube(pts,radius,material)

def jewel(x,y,z,w,h,mat='opal_pink',sides=16):
    # Pavillion in relief, girdle, raised table and prong setting.
    ring=[]
    for i in range(sides):
        a=2*math.pi*i/sides
        if i<sides//2: # oval drop with narrow top
            shaping=.77
        else:shaping=1.
        ring.append([x+w*math.sin(a)*shaping,y+h*math.cos(a),z])
    ring=np.array(ring)
    p_table=np.column_stack((x+(ring[:,0]-x)*.59,y+(ring[:,1]-y)*.59,np.full(sides,z+.062)))
    front=np.array([x,y,z+.09])
    pavilion=np.array([x,y,z-.09])
    faces=[];vertices=[]
    def facet(a,b,c):
        start=len(vertices);vertices.extend((a,b,c));faces.append((start,start+1,start+2))
    for i in range(sides):
        j=(i+1)%sides
        facet(ring[i],ring[j],p_table[j]);facet(ring[i],p_table[j],p_table[i])
        facet(p_table[i],p_table[j],front)
        facet(ring[j],ring[i],pavilion)
    push(trimesh.Trimesh(vertices=np.array(vertices),faces=np.array(faces),process=False),mat)
    rounded_ring(x,y,z+.01,w*1.06,h*1.06,.008 if w>.03 else .0038,'rose_gold')
    if w>.023:
        for side in (-1,1):
            for vy in (-1,1):
                center=np.array([x+side*w*.75,y+vy*h*.68,z+.055])
                push(trimesh.creation.icosphere(subdivisions=0,radius=.008 if w<.06 else .012).apply_translation(center),'champagne')

def main():
    # The curved rim is visible from the sides and follows the cranial outline.
    for offset,thickness,material in ((-.515,.009,'champagne'),(-.548,.019,'rose_gold'),(-.585,.011,'silver')):
        pts=[]
        for j in range(79):
            t=j/78
            x=(t-.5)*1.11
            z=.08-.31*abs(x/.55)**2
            y=offset-.018*(1-(x/.55)**2)
            pts.append((x,y,z))
        tube(pts,thickness,material,10)
    # Symmetrical artisan-curled arms / branches.
    for side in (-1,1):
        for tier in range(3):
            x=side*(.12+tier*.13)
            tip=-.82+tier*.062
            curve([[side*.045,-.54,.13],[side*(.12+tier*.027),-.70,.14],
                [x,tip,.14],[x+side*.073,tip-.085,.085],
                [x+side*.115,tip+.045,.085],[x+side*.02,-.55,.12]],
                .011 if tier==0 else .008,'rose_gold',steps=56)
            spiral(x+side*.05,tip+.02,.143,.08,side,'champagne')
        curve([[side*.025,-.62,.13],[side*.09,-.91,.11],
              [side*.20,-1.105,.068],[side*.275,-.93,.082],
              [side*.43,-.73,.11],[side*.49,-.55,.071]],.011,'rose_gold',steps=74)
        curve([[side*.04,-.56,.14],[side*.18,-.77,.16],
             [side*.29,-.87,.13],[side*.38,-.68,.135]],.008,'silver',steps=54)
        spiral(side*.23,-.69,.145,.087,side,'champagne')
        jewel(side*.27,-.91,.17,.037,.065,'opal_blue')
        jewel(side*.40,-.75,.17,.032,.052,'opal_pink')
    curve([[-.18,-.56,.15],[-.22,-.85,.16],[-.10,-1.13,.105],
          [0,-1.2,.11],[.1,-1.13,.105],[.22,-.85,.16],[.18,-.56,.15]],.013,'rose_gold',steps=95)
    for side in (-1,1):
        curve([[0,-.56,.16],[side*.12,-.7,.16],[side*.17,-.84,.18],
                [side*.09,-.99,.14],[0,-1.02,.15]],.008,'silver',steps=64)
    # Tall central multichromatic dropstone and its raised bezel.
    rounded_ring(0,-.91,.24,.143,.235,.026,'dark_gold')
    rounded_ring(0,-.91,.28,.135,.228,.011,'champagne')
    jewel(0,-.92,.32,.134,.211,'opal_violet',sides=20)
    jewel(0,-1.22,.20,.038,.064,'opal_blue')
    jewel(-.116,-1.16,.19,.026,.043,'diamond')
    jewel(.116,-1.16,.19,.026,.043,'diamond')
    for k in range(-10,11):
        if abs(k)<3:continue
        x=k*.048
        z=.14-.17*(abs(x)/.55)**2
        palette=('opal_blue','opal_pink','diamond','opal_cyan','opal_gold')
        jewel(x,-.552-.006*math.cos(k*.6),z+.045,.014,.019,palette[abs(k)%len(palette)],sides=12)
    for side in (-1,1):
        for k in range(13):
            t=k/12
            x=side*(.12+.34*t)
            y=-.79+.2*t+.027*math.sin(t*3.1)
            z=.17-.08*t
            jewel(x,y,z,.008,.014,('diamond','opal_blue','opal_pink','opal_gold')[k%4],sides=10)
        for k in range(8):
            x=side*(.10+k*.051)
            y=-.61-.035*math.sin(k*.5)
            jewel(x,y,.165,.008,.01,'diamond',sides=8)
    # Material-batched GLB meshes to avoid one draw call per gemstone.
    scene=trimesh.Scene()
    triangle_count=0
    for name,parts in groups.items():
        if not parts:continue
        combined=trimesh.util.concatenate(parts)
        color,metallic,roughness=material_colors[name]
        material=PBRMaterial(name=name,baseColorFactor=list(color),metallicFactor=metallic,
                             roughnessFactor=roughness,doubleSided=True)
        combined.visual=trimesh.visual.TextureVisuals(material=material)
        triangle_count+=len(combined.faces)
        scene.add_geometry(combined,node_name=f'couture_{name}',geom_name=name)
    output.parent.mkdir(parents=True,exist_ok=True)
    glb=scene.export(file_type='glb')
    output.write_bytes(glb)
    print('written',output,'bytes',len(glb),'triangles',triangle_count,'materials',len(groups),
          'bounds',scene.bounds.round(3).tolist())
    assert len(glb)>120000
    assert triangle_count>10000
    assert scene.bounds[0,1]<-1.1 and scene.bounds[1,1]<-.45

if __name__=='__main__':main()

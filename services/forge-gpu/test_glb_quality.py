import unittest, struct, json
from glb_quality import inspect_glb_bytes

def sample(mesh=True):
    doc={"asset":{"version":"2.0"}, "accessors":[{"count":300}],
         "meshes":[{"primitives":[{"attributes":{"POSITION":0,"NORMAL":0,"TEXCOORD_0":0}, "indices":0, "material":0}]}] if mesh else [],
         "materials":[{"pbrMetallicRoughness":{"baseColorFactor":[1,1,1,1]}}],"images":[{}]}
    body=json.dumps(doc).encode(); body+=b' ' *((-len(body))%4)
    return b'glTF'+struct.pack('<II',2,12+8+len(body))+struct.pack('<II',len(body),0x4E4F534A)+body

class QualityTests(unittest.TestCase):
 def test_metrics(self):
  m=inspect_glb_bytes(sample())
  self.assertEqual(m['triangles'],100)
  self.assertTrue(m['hasUV'])
  self.assertTrue(m['hasNormals'])
  self.assertTrue(m['mobileBudgetPass'])
 def test_wrong_size(self):
  with self.assertRaisesRegex(ValueError, 'size'):
   inspect_glb_bytes(sample() + b'x')
 def test_empty_mesh(self):
  with self.assertRaisesRegex(ValueError, 'no_triangles'):
   inspect_glb_bytes(sample(False))
 def test_non_glb(self):
  with self.assertRaises(ValueError):
   inspect_glb_bytes(b'not a glb')

if __name__ == '__main__':unittest.main()

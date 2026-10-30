"""Private four-angle wireframe QA test; no GPU/network/PBR claims."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from test_build_private_lods import fixture
from wireframe_review_views import create_wireframe_review


class WireframeViewsTests(unittest.TestCase):
    def test_creates_four_local_svg_review_projections_without_touching_source(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/"model.glb"
            fixture(source,300)
            before=hashlib.sha256(source.read_bytes()).hexdigest()
            output=Path(folder)/"views"
            data=create_wireframe_review(source,output)
            self.assertEqual(set(data["files"]),
                             {"front.svg","back.svg","left.svg","right.svg"})
            self.assertGreater(data["sampledFacesAcrossFourViews"],0)
            self.assertTrue(data["humanReviewRequired"])
            self.assertFalse(data["visualSimilarityProven"])
            self.assertFalse(data["publicationApproved"])
            self.assertEqual(data["type"],"sparse-wireframe-not-PBR")
            for file in data["files"]:
                self.assertTrue((output/file).is_file())
                root=ET.parse(output/file).getroot()
                self.assertEqual(root.attrib["viewBox"],"0 0 600 600")
                self.assertIn("svg",root.tag)
                self.assertGreater(len(list(root.iter())),3)
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),before)

    def test_no_overwrite_of_existing_review_dir(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/"model.glb";fixture(source,100)
            output=Path(folder)/"views";output.mkdir()
            (output/"keep.txt").write_text("important")
            with self.assertRaisesRegex(FileExistsError,"output_exists"):
                create_wireframe_review(source,output)
            self.assertEqual((output/"keep.txt").read_text(),"important")

    def test_refuses_corrupt_glb_and_no_images_emitted(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/"bad.glb"
            fixture(source,100)
            raw=bytearray(source.read_bytes())
            raw[:4]=b"NOPE"
            source.write_bytes(raw)
            dest=Path(folder)/"views"
            with self.assertRaisesRegex(ValueError,"topology_glb_header_invalid"):
                create_wireframe_review(source,dest)
            self.assertFalse(dest.exists())

    def test_rejects_unbounded_draw_density(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/"model.glb";fixture(source,100)
            with self.assertRaisesRegex(ValueError,"wireframe_draw_budget_invalid"):
                create_wireframe_review(
                    source,Path(folder)/"views",max_faces_per_primitive=100000
                )


if __name__=="__main__":
    unittest.main()

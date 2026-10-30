"""Offline Spaktok Studio production orchestration contract tests.

Fixtures only. Never starts a GPU, spends credits, uploads to R2, or
contacts Rodin. The paid-inference path is mocked to assert exactly one call.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import spaktok_studio_production as studio
from test_build_private_lods import fixture


class StudioProductionTests(unittest.TestCase):
    def make_source(self, root, faces=1000):
        source = Path(root) / "creator.glb"
        fixture(source, faces)
        return source

    def test_end_to_end_private_five_department_manifest_from_existing_glb(self):
        with tempfile.TemporaryDirectory() as root:
            source = self.make_source(root)
            output = Path(root)/"private-result"
            before = hashlib.sha256(source.read_bytes()).hexdigest()
            result = studio.produce_private_draft(
                output_dir=output, glb=source, rights_confirmed=True,
                make_lods=False, description="Original owner character",
            )
            self.assertTrue((output/"source.glb").is_file())
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), before)
            self.assertEqual(result["schema"], "spaktok-private-production-draft-v1")
            self.assertEqual(result["visibility"], "owner-private")
            self.assertEqual(result["source"]["sha256"], before)
            self.assertEqual(result["computeJobsRequested"], 0)
            self.assertFalse(result["autoChargeOrRetry"])
            self.assertEqual(
                {d["target"] for d in result["departments"]},
                set(studio.DEPARTMENTS),
            )
            self.assertTrue(all(
                d["status"] == "needs-optimization" and
                d["published"] is False and
                "android_fps_thermals_unmeasured" in d["blockers"]
                for d in result["departments"]
            ))
            self.assertEqual(result["optimization"]["status"], "not-requested")
            self.assertEqual(
                result["visualReview"]["status"],
                "four-angle-wireframe-created-awaiting-human-review",
            )
            self.assertEqual(
                {Path(p).name for p in result["visualReview"]["views"]},
                {"front.svg", "back.svg", "left.svg", "right.svg"},
            )
            self.assertTrue(all(
                (output / name).is_file()
                for name in result["visualReview"]["views"]
            ))
            self.assertTrue(result["visualReview"]["sparseWireframeOnly"])
            self.assertFalse(result["visualReview"]["pbrTurntableHumanReviewComplete"])
            self.assertFalse(result["release"]["published"])
            self.assertFalse(result["release"]["rigAndFacialTrackingApproved"])
            self.assertEqual(result, json.loads((output/"manifest.json").read_text()))

    def test_no_approvals_means_no_output_and_no_gpu_call(self):
        with tempfile.TemporaryDirectory() as root:
            photo = Path(root)/"photo.png"
            photo.write_bytes(b"p"*512)
            output = Path(root)/"private"
            with patch.object(studio, "post_one_image") as post:
                for opts in [
                    {},
                    {"rights_confirmed": True},
                    {"rights_confirmed": True, "execute_gpu_once": True},
                    {"rights_confirmed": True, "permit_image_transfer": True},
                ]:
                    with self.assertRaises(PermissionError):
                        studio.produce_private_draft(
                            output_dir=output, image=photo, make_lods=False,
                            **opts,
                        )
                post.assert_not_called()
                self.assertFalse(output.exists())

    def test_gpu_runs_at_most_once_with_explicit_owner_approvals(self):
        with tempfile.TemporaryDirectory() as root:
            source = self.make_source(root)
            photo = Path(root)/"creator.png"
            photo.write_bytes(b"photo-test-no-identifiers"*64)
            output = Path(root)/"private"
            token = "x"*48
            with patch.dict(studio.os.environ, {"FORGE_GPU_TOKEN": token}), \
                 patch.object(studio, "post_one_image",
                              return_value=source.read_bytes()) as post:
                done = studio.produce_private_draft(
                    output_dir=output, image=photo, make_lods=False,
                    rights_confirmed=True, permit_image_transfer=True,
                    execute_gpu_once=True,
                )
            self.assertEqual(post.call_count, 1)
            self.assertEqual(post.call_args.args[2], token)
            self.assertEqual(done["computeJobsRequested"], 1)
            self.assertEqual(
                done["sourcePhotoSha256"],
                hashlib.sha256(photo.read_bytes()).hexdigest(),
            )
            self.assertFalse(done["release"]["published"])
            self.assertTrue((output/"source.glb").exists())

    def test_invalid_gpu_profile_or_missing_secret_refuses_transfer(self):
        with tempfile.TemporaryDirectory() as root:
            photo = Path(root)/"creator.png"
            photo.write_bytes(b"z"*512)
            with patch.dict(studio.os.environ, {"FORGE_GPU_TOKEN": ""}), \
                 patch.object(studio, "post_one_image") as post:
                with self.assertRaisesRegex(PermissionError, "secret_missing"):
                    studio.produce_private_draft(
                        output_dir=Path(root)/"private", image=photo,
                        rights_confirmed=True, permit_image_transfer=True,
                        execute_gpu_once=True,
                    )
                post.assert_not_called()

    def test_lod_quality_rejection_keeps_original_private_and_unpublished(self):
        with tempfile.TemporaryDirectory() as root:
            source = self.make_source(root)
            output = Path(root)/"private"
            with patch.object(studio.shutil, "which", return_value="/bin/true"), \
                 patch.object(studio, "generate_lods",
                              side_effect=ValueError("lod_topology_invalid")) as lod:
                manifest = studio.produce_private_draft(
                    output_dir=output, glb=source, rights_confirmed=True,
                )
            lod.assert_called_once()
            self.assertEqual(
                manifest["optimization"]["status"], "rejected-by-quality-gate"
            )
            self.assertFalse((output/"lods").exists())
            self.assertFalse(manifest["release"]["releaseApproved"])
            self.assertTrue((output/"source.glb").is_file())

    def test_lod_accepts_genuine_cpu_toolchain_and_discloses_budgets(self):
        with tempfile.TemporaryDirectory() as root:
            source = self.make_source(root)
            output = Path(root)/"private"
            def fake_gltfpack(args, **kwargs):
                count = 480 if args[args.index("-si")+1] == "0.50" else 190
                fixture(Path(args[args.index("-o")+1]), count)
                return subprocess.CompletedProcess(args, 0, "", "")
            with patch.object(studio.shutil, "which", return_value="/bin/true"), \
                 patch("build_private_lods.subprocess.run", side_effect=fake_gltfpack):
                result = studio.produce_private_draft(
                    output_dir=output, glb=source, rights_confirmed=True,
                )
            self.assertTrue((output/"lods"/"pack.json").is_file())
            self.assertEqual(result["optimization"]["status"],
                             "structurally-generated-needs-visual-review")
            self.assertTrue(result["optimization"]["targetsMet"])
            self.assertFalse(result["release"]["releaseApproved"])
            self.assertTrue(all(
                d["status"] == "needs-optimization"
                for d in result["departments"]
            ))

    def test_matched_rodin_technical_report_never_declares_winner(self):
        with tempfile.TemporaryDirectory() as root:
            source = self.make_source(root)
            other = Path(root)/"rodin.glb"
            other.write_bytes(source.read_bytes())
            output = Path(root)/"private"
            with self.assertRaisesRegex(ValueError, "matched_reference"):
                studio.produce_private_draft(
                    output_dir=output, glb=source, rodin=other,
                    rights_confirmed=True, make_lods=False,
                )
            self.assertFalse(output.exists())
            manifest = studio.produce_private_draft(
                output_dir=output, glb=source, rodin=other,
                rights_confirmed=True, make_lods=False,
                same_reference_confirmed=True,
            )
            report = json.loads((output/"rodin-comparison.json").read_text())
            self.assertTrue(report["sameReferenceConfirmedByOwner"])
            self.assertIsNone(report["winner"])
            self.assertIsNone(manifest["comparison"]["winner"])

    def test_invalid_source_prevents_partial_pack_or_overwrites(self):
        with tempfile.TemporaryDirectory() as root:
            source = Path(root)/"broken.glb"
            source.write_bytes(b"NOPE"*100)
            output = Path(root)/"private"
            with self.assertRaises((ValueError, OSError, KeyError)):
                studio.produce_private_draft(
                    output_dir=output, glb=source,
                    rights_confirmed=True, make_lods=False,
                )
            self.assertFalse(output.exists())
            fixture(source, 100)
            output.mkdir()
            (output/"important.txt").write_text("keep")
            with self.assertRaises(FileExistsError):
                studio.produce_private_draft(
                    output_dir=output, glb=source,
                    rights_confirmed=True, make_lods=False,
                )
            self.assertEqual((output/"important.txt").read_text(), "keep")

    def test_rejects_multiview_claim_by_not_accepting_multiple_sources(self):
        with tempfile.TemporaryDirectory() as root:
            source = self.make_source(root)
            with self.assertRaisesRegex(ValueError, "choose_exactly_one"):
                studio.produce_private_draft(
                    output_dir=Path(root)/"private", glb=source,
                    image=Path(root)/"p.png", rights_confirmed=True,
                )
            with self.assertRaisesRegex(ValueError, "unknown_studio_target"):
                studio.produce_private_draft(
                    output_dir=Path(root)/"private", glb=source,
                    rights_confirmed=True, targets=("avatar", "money"),
                )


if __name__ == "__main__":
    unittest.main()

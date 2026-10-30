"""20 matched-reference Rodin blind benchmark evidence tests (offline)."""
import hashlib
import tempfile
import unittest
from pathlib import Path

from rodin_blind_benchmark import template, inspect_suite
from test_build_private_lods import fixture


class RodinBlindBenchmarkTests(unittest.TestCase):
    def test_template_has_20_distinct_rights_unconfirmed_reference_slots(self):
        t=template()
        self.assertEqual(len(t["cases"]),20)
        self.assertEqual(len({v["id"] for v in t["cases"]}),20)
        self.assertEqual({v["rightsConfirmed"] for v in t["cases"]},{False})
        self.assertEqual({v["sameReferenceConfirmed"] for v in t["cases"]},{False})
        self.assertTrue(all(not v["blindVotes"] for v in t["cases"]))
        a=inspect_suite(t)
        self.assertFalse(a["readyForReview"])
        self.assertEqual(a["completedCases"],0)
        self.assertIsNone(a["winner"])
        self.assertIsNone(a["medianCostEUR"])
        self.assertFalse(a["preferenceThreshold60PercentReached"])

    def test_invalid_reference_metadata_or_duplicate_rater_is_refused(self):
        t=template()
        t["cases"][0]["referenceSha256"]="not-a-sha"
        with self.assertRaisesRegex(ValueError,"reference_hash"):
            inspect_suite(t)
        t=template()
        t["cases"][0]["blindVotes"]=[
            {"raterId":"judge1","preferred":"rodin"},
            {"raterId":"judge1","preferred":"spaktok"},
        ]
        with self.assertRaisesRegex(ValueError,"rater_duplicated"):
            inspect_suite(t)

    def test_19_valid_cases_still_cannot_reach_full_study_requirement(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root)
            a=p/"a.glb"; b=p/"b.glb"
            fixture(a,200)
            fixture(b,200)
            cases=template()
            for index,case in enumerate(cases["cases"][:19]):
                case.update({
                    "rightsConfirmed":True,
                    "sameReferenceConfirmed":True,
                    "referenceSha256":hashlib.sha256(str(index).encode()).hexdigest(),
                    "spaktokGlb":str(a),"rodinGlb":str(b),
                    "costEUR":{"spaktok":.5,"rodin":1.},
                    "latencySeconds":{"spaktok":15,"rodin":20},
                    "blindVotes":[{"raterId":str(k),"preferred":"spaktok"} for k in range(5)],
                })
            out=inspect_suite(cases)
            self.assertEqual(out["completedCases"],19)
            self.assertEqual(out["blindVotes"]["count"],95)
            self.assertFalse(out["readyForReview"])
            self.assertFalse(out["preferenceThreshold60PercentReached"])
            self.assertIsNone(out["winner"])
            self.assertFalse(out["releaseApproved"])

    def test_complete_but_artificial_study_does_not_declare_winner(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root)
            a=p/"a.glb"; b=p/"b.glb"
            fixture(a,200); fixture(b,180)
            cases=template()
            for index,case in enumerate(cases["cases"]):
                case.update({
                    "rightsConfirmed":True,
                    "sameReferenceConfirmed":True,
                    "referenceSha256":hashlib.sha256(str(index).encode()).hexdigest(),
                    "spaktokGlb":str(a),"rodinGlb":str(b),
                    "costEUR":{"spaktok":0.6,"rodin":1.2},
                    "latencySeconds":{"spaktok":20,"rodin":40},
                    "blindVotes":[
                        {"raterId":str(k),"preferred":"spaktok"}
                        for k in range(5)
                    ],
                })
            out=inspect_suite(cases)
            self.assertEqual(out["completedCases"],20)
            self.assertTrue(out["readyForReview"])
            self.assertEqual(out["blindVotes"]["spaktok"],100)
            self.assertTrue(out["preferenceThreshold60PercentReached"])
            self.assertIsNone(out["winner"])
            self.assertFalse(out["releaseApproved"])
            self.assertFalse(out["cases"][0]["technical"]["visualQualityMeasuredByMachine"])
            self.assertNotIn("spaktokGlb",str(out))
            self.assertEqual(out["medianCostEUR"],{"spaktok":0.6,"rodin":1.2})

    def test_unmatched_reference_never_inspects_assets(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root); a=p/"a.glb"; b=p/"b.glb"
            fixture(a,200);fixture(b,180)
            t=template()
            item=t["cases"][0]
            item["spaktokGlb"]=str(a);item["rodinGlb"]=str(b)
            item["referenceSha256"]=hashlib.sha256(b"reference").hexdigest()
            item["rightsConfirmed"]=True
            # Missing same-reference attestation is fail-closed.
            report=inspect_suite(t)
            self.assertFalse(report["cases"][0]["complete"])
            self.assertIsNone(report["cases"][0]["technical"])


if __name__=="__main__":
    unittest.main()

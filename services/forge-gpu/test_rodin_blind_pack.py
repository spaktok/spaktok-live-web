import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest import mock

import rodin_blind_pack as pack
from rodin_blind_benchmark import template


def glb(doc: dict) -> bytes:
    payload = json.dumps(doc).encode()
    payload += b" " * (-len(payload) % 4)
    binary = b"\0\0\0\0"
    body = (struct.pack("<II", len(payload), 0x4E4F534A) + payload +
            struct.pack("<II", len(binary), 0x004E4942) + binary)
    return struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body


def read_json_chunk(data: bytes) -> dict:
    length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + length])


class BlindPackTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.spec = template()
        for n, case in enumerate(self.spec["cases"][:2]):
            s = self.root / f"s{n}.glb"
            r = self.root / f"r{n}.glb"
            s.write_bytes(glb({"asset": {"version": "2.0", "generator": "TRELLIS"}}))
            r.write_bytes(glb({"asset": {"version": "2.0", "generator": "Rodin"},
                               "extras": {"vendor": "x"}, "nodes": [{"name": "rodin_mesh"}]}))
            case.update(rightsConfirmed=True, sameReferenceConfirmed=True,
                        referenceSha256="a" * 64, spaktokGlb=str(s), rodinGlb=str(r))

    def tearDown(self):
        self.tmp.cleanup()

    def test_neutralize_strips_identity_and_keeps_binary(self):
        src = glb({"asset": {"version": "2.0", "generator": "Rodin", "copyright": "c"},
                   "extras": {"a": 1}, "materials": [{"name": "rodin", "extras": {}}]})
        out = pack.neutralize_glb(src)
        doc = read_json_chunk(out)
        self.assertEqual(doc["asset"], {"version": "2.0"})
        self.assertNotIn("extras", doc)
        self.assertEqual(doc["materials"], [{}])
        self.assertEqual(struct.unpack_from("<I", out, 8)[0], len(out))
        self.assertTrue(out.endswith(b"\0\0\0\0"))
        self.assertNotIn(b"Rodin", out)

    def test_neutralize_rejects_bad_header(self):
        with self.assertRaises(ValueError):
            pack.neutralize_glb(b"glTF" + b"\0" * 30)

    def test_pack_key_outside_and_page_has_no_origin(self):
        out = self.root / "pack"
        with self.assertRaisesRegex(ValueError, "outside"):
            pack.build_pack(self.spec, out, out / "key.json")
        key_path = self.root / "owner" / "key.json"
        result = pack.build_pack(self.spec, out, key_path)
        self.assertEqual(result["cases"], 2)
        page = (out / "index.html").read_text()
        self.assertNotIn("spaktok", page.replace(pack.VOTES_SCHEMA, ""))
        self.assertNotIn("rodin", page.lower().replace(pack.VOTES_SCHEMA, ""))
        self.assertNotIn("ref-01", page)
        for blind in ("case-01", "case-02"):
            for slot in ("A", "B"):
                data = (out / blind / f"{slot}.glb").read_bytes()
                self.assertNotIn(b"Rodin", data)
                self.assertNotIn(b"TRELLIS", data)
        self.assertEqual(key_path.stat().st_mode & 0o777, 0o600)
        with self.assertRaisesRegex(ValueError, "not_empty"):
            pack.build_pack(self.spec, out, self.root / "k2.json")

    def test_merge_unblinds_and_feeds_audit(self):
        key_path = self.root / "key.json"
        with mock.patch.object(pack.secrets.SystemRandom, "random", return_value=0.1):
            pack.build_pack(self.spec, self.root / "pack", key_path)
        key = json.loads(key_path.read_text())
        exports = [{"schema": pack.VOTES_SCHEMA, "packId": key["packId"], "raterId": f"r{n}",
                    "votes": [{"caseId": "case-01", "choice": "A"},
                              {"caseId": "case-02", "choice": "tie"}]} for n in range(5)]
        merged = pack.merge_votes(self.spec, key, exports)
        case_id = key["assignments"]["case-01"]["caseId"]
        votes = next(c for c in merged["cases"] if c["id"] == case_id)["blindVotes"]
        self.assertEqual(len(votes), 5)
        self.assertTrue(all(v["preferred"] == "spaktok" for v in votes))

    def test_merge_rejects_wrong_pack_dup_rater_and_sixth(self):
        key_path = self.root / "key.json"
        pack.build_pack(self.spec, self.root / "pack", key_path)
        key = json.loads(key_path.read_text())

        def export(rater, pack_id=key["packId"]):
            return {"schema": pack.VOTES_SCHEMA, "packId": pack_id, "raterId": rater,
                    "votes": [{"caseId": "case-01", "choice": "B"}]}

        with self.assertRaisesRegex(ValueError, "pack_mismatch"):
            pack.merge_votes(json.loads(json.dumps(self.spec)), key, [export("r", "x")])
        with self.assertRaisesRegex(ValueError, "duplicated"):
            pack.merge_votes(json.loads(json.dumps(self.spec)), key, [export("r"), export("r")])
        with self.assertRaisesRegex(ValueError, "five"):
            pack.merge_votes(json.loads(json.dumps(self.spec)), key,
                             [export(f"r{n}") for n in range(6)])
        bad = export("r")
        bad["votes"].append({"caseId": "case-01", "choice": "A"})
        with self.assertRaisesRegex(ValueError, "entry_invalid"):
            pack.merge_votes(json.loads(json.dumps(self.spec)), key, [bad])


if __name__ == "__main__":
    unittest.main()

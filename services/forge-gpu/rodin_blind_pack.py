#!/usr/bin/env python3
"""Blind rater pack + vote merge for rodin_blind_benchmark.py.

pack:  copies each paired case's two GLBs as A.glb / B.glb (CSPRNG order),
       neutralizes identifying glTF metadata (asset.generator/copyright,
       extras, names), writes a static rater page, and writes the A/B key to a
       separate owner-only file that must never be given to raters.
merge: un-blinds rater exports with that key and appends them to the spec's
       blindVotes, so `rodin_blind_benchmark.py --audit` can score them.

No uploads, no network, no scores invented. Serve the pack locally with
`python -m http.server` from the pack directory (browsers block file:// GLB loads).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import secrets
import struct
import sys

from rodin_blind_benchmark import inspect_suite

PACK_SCHEMA = "spaktok-rodin-blind-pack-v1"
VOTES_SCHEMA = "spaktok-rodin-blind-votes-v1"
MAX_RATERS = 5
GLB_MAGIC = 0x46546C67
JSON_CHUNK = 0x4E4F534A


def neutralize_glb(data: bytes) -> bytes:
    if len(data) < 20:
        raise ValueError("glb_too_small")
    magic, version, total = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC or version != 2 or total != len(data):
        raise ValueError("glb_header_invalid")
    json_len, json_type = struct.unpack_from("<II", data, 12)
    if json_type != JSON_CHUNK or 20 + json_len > len(data):
        raise ValueError("glb_json_chunk_invalid")
    doc = json.loads(data[20:20 + json_len].decode("utf-8"))
    rest = data[20 + json_len:]
    doc["asset"] = {"version": doc.get("asset", {}).get("version", "2.0")}
    doc.pop("extras", None)
    for value in doc.values():
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    item.pop("name", None)
                    item.pop("extras", None)
    payload = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    payload += b" " * (-len(payload) % 4)
    body = struct.pack("<II", len(payload), JSON_CHUNK) + payload + rest
    return struct.pack("<III", GLB_MAGIC, 2, 12 + len(body)) + body


RATER_PAGE = """<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blind 3D review</title>
<script type="module" src="https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js"></script>
<style>
:root{--bg:#f3f4f2;--fg:#1d2321;--muted:#5b6662;--line:#cfd5d2;--accent:#0f6b5c}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
main{max-width:1100px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:16px}
.pair{display:flex;flex-wrap:wrap;gap:12px}.pair figure{flex:1 1 320px;margin:0;border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden}
model-viewer{width:100%;height:360px;background:#fff}figcaption{padding:8px 12px;font-weight:600}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}button,input{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid var(--line);background:#fff;color:var(--fg)}
button[aria-pressed=true]{background:var(--accent);color:#fff;border-color:var(--accent)}p{margin:0;color:var(--muted)}
</style></head><body><main>
<h1>مراجعة عمياء: أي مجسّم أفضل؟</h1>
<p>قارن الشكل والخامات والتفاصيل من كل الزوايا. لا تعرف مصدر أي نموذج. صوّت مرة واحدة لكل حالة ثم صدّر ملف الأصوات.</p>
<div class="row"><label for="rater">رمز المقيّم</label><input id="rater" maxlength="40" autocomplete="off"></div>
<div class="row" id="nav"></div>
<h2 id="title"></h2>
<div class="pair">
<figure><model-viewer id="a" camera-controls auto-rotate shadow-intensity="1" alt="Model A"></model-viewer><figcaption>A</figcaption></figure>
<figure><model-viewer id="b" camera-controls auto-rotate shadow-intensity="1" alt="Model B"></model-viewer><figcaption>B</figcaption></figure>
</div>
<div class="row" role="group" aria-label="vote">
<button data-v="A">A أفضل</button><button data-v="tie">متساويان</button><button data-v="B">B أفضل</button>
</div>
<div class="row"><button id="export">تصدير الأصوات</button><p id="status" aria-live="polite"></p></div>
</main><script>
const PACK=__PACK__;const votes={};let i=0;
const $=id=>document.getElementById(id);
function show(){const c=PACK.cases[i];$("title").textContent=`${i+1} / ${PACK.cases.length}`;
$("a").src=`${c.id}/A.glb`;$("b").src=`${c.id}/B.glb`;
document.querySelectorAll("[data-v]").forEach(b=>b.setAttribute("aria-pressed",votes[c.id]===b.dataset.v));
$("nav").replaceChildren(...PACK.cases.map((x,k)=>{const b=document.createElement("button");b.textContent=k+1;
b.setAttribute("aria-pressed",k===i);b.title=votes[x.id]?"voted":"";b.onclick=()=>{i=k;show()};return b}));
$("status").textContent=`${Object.keys(votes).length} / ${PACK.cases.length}`;}
document.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{votes[PACK.cases[i].id]=b.dataset.v;
if(i<PACK.cases.length-1)i++;show()});
$("export").onclick=()=>{const r=$("rater").value.trim();if(!/^[A-Za-z0-9_-]{1,40}$/.test(r)){$("status").textContent="رمز المقيّم: حروف لاتينية وأرقام فقط";return}
const out={schema:"__VOTES__",packId:PACK.packId,raterId:r,votes:Object.entries(votes).map(([caseId,choice])=>({caseId,choice}))};
const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:"application/json"}));
a.download=`votes-${r}.json`;a.click();URL.revokeObjectURL(a.href)};
show();
</script></body></html>
"""


def build_pack(spec: dict, out_dir: Path, key_path: Path) -> dict:
    inspect_suite(spec)
    out_dir = out_dir.resolve()
    key_path = key_path.resolve()
    if key_path.is_relative_to(out_dir):
        raise ValueError("pack_key_must_be_outside_pack_dir")
    if out_dir.exists() and any(out_dir.iterdir()):
        raise ValueError("pack_dir_not_empty")
    paired = [c for c in spec["cases"] if c.get("rightsConfirmed") and
              c.get("sameReferenceConfirmed") and
              isinstance(c.get("spaktokGlb"), str) and isinstance(c.get("rodinGlb"), str)]
    if not paired:
        raise ValueError("pack_no_paired_cases")
    rng = secrets.SystemRandom()
    order = paired[:]
    rng.shuffle(order)
    pack_id = secrets.token_hex(8)
    key = {"schema": PACK_SCHEMA, "packId": pack_id, "assignments": {}}
    out_dir.mkdir(parents=True, exist_ok=True)
    public_cases = []
    for n, case in enumerate(order, 1):
        blind_id = f"case-{n:02d}"
        a_is_spaktok = rng.random() < 0.5
        sources = {"spaktok": Path(case["spaktokGlb"]), "rodin": Path(case["rodinGlb"])}
        mapping = {"A": "spaktok" if a_is_spaktok else "rodin",
                   "B": "rodin" if a_is_spaktok else "spaktok"}
        (out_dir / blind_id).mkdir()
        for slot, origin in mapping.items():
            (out_dir / blind_id / f"{slot}.glb").write_bytes(
                neutralize_glb(sources[origin].read_bytes()))
        key["assignments"][blind_id] = {"caseId": case["id"], **mapping}
        public_cases.append({"id": blind_id})
    public = {"packId": pack_id, "cases": public_cases}
    page = (RATER_PAGE.replace("__PACK__", json.dumps(public))
            .replace("__VOTES__", VOTES_SCHEMA))
    (out_dir / "index.html").write_text(page, encoding="utf-8")
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.write_text(json.dumps(key, indent=1), encoding="utf-8")
    key_path.chmod(0o600)
    return {"packId": pack_id, "cases": len(public_cases)}


def merge_votes(spec: dict, key: dict, exports: list[dict]) -> dict:
    inspect_suite(spec)
    if key.get("schema") != PACK_SCHEMA or not isinstance(key.get("assignments"), dict):
        raise ValueError("pack_key_invalid")
    by_id = {c["id"]: c for c in spec["cases"]}
    raters = set()
    for export in exports:
        if export.get("schema") != VOTES_SCHEMA or export.get("packId") != key["packId"]:
            raise ValueError("votes_pack_mismatch")
        rater = export.get("raterId")
        if not isinstance(rater, str) or not 1 <= len(rater) <= 40 or rater in raters:
            raise ValueError("votes_rater_invalid_or_duplicated")
        raters.add(rater)
        seen = set()
        for vote in export.get("votes", []):
            assign = key["assignments"].get(vote.get("caseId"))
            choice = vote.get("choice")
            if assign is None or choice not in ("A", "B", "tie") or vote["caseId"] in seen:
                raise ValueError("votes_entry_invalid")
            seen.add(vote["caseId"])
            case = by_id[assign["caseId"]]
            votes = case.setdefault("blindVotes", [])
            if any(v.get("raterId") == rater for v in votes):
                raise ValueError("votes_rater_already_merged")
            votes.append({"raterId": rater,
                          "preferred": "tie" if choice == "tie" else assign[choice]})
            if len(votes) > MAX_RATERS:
                raise ValueError("votes_more_than_five_raters")
    inspect_suite(spec)
    return spec


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    modes = cli.add_mutually_exclusive_group(required=True)
    modes.add_argument("--pack", type=Path, help="filled benchmark spec")
    modes.add_argument("--merge", type=Path, help="benchmark spec to merge into")
    cli.add_argument("--out", type=Path, help="pack directory (pack mode)")
    cli.add_argument("--key", type=Path, required=True, help="owner-only A/B key file")
    cli.add_argument("--votes", type=Path, nargs="*", default=[])
    cli.add_argument("--output", type=Path, help="merged spec (merge mode)")
    args = cli.parse_args()
    try:
        if args.pack:
            if not args.out:
                raise ValueError("pack_requires_out")
            result = build_pack(json.loads(args.pack.read_text()), args.out, args.key)
        else:
            if not args.output or not args.votes:
                raise ValueError("merge_requires_votes_and_output")
            merged = merge_votes(json.loads(args.merge.read_text()),
                                 json.loads(args.key.read_text()),
                                 [json.loads(p.read_text()) for p in args.votes])
            args.output.write_text(json.dumps(merged, indent=1), encoding="utf-8")
            result = {"merged": len(args.votes), "output": str(args.output)}
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 2
    print(json.dumps({"ok": True, **result}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

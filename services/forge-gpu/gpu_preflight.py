"""Pure-Python CUDA/PyTorch compatibility gate for Spaktok Forge.

Checks *before* downloading large models or running paid inference. It cannot
prove custom extension, SF3D model or CUDA driver compatibility; the actual
one-tensor CUDA smoke test is needed for that initial signal.
"""
from __future__ import annotations

import json
import re
from typing import Any


class IncompatibleGPU(RuntimeError):
    """Fail closed instead of consuming a rented GPU with incompatible torch."""


def verify_cuda_build(
    capability: tuple[int, int],
    cuda_build: str | None,
    arches: list[str] | tuple[str, ...],
) -> dict[str, Any]:
    if len(capability) != 2 or any(not isinstance(x, int) or x < 0 for x in capability):
        raise IncompatibleGPU("invalid_cuda_device_capability")
    match = re.fullmatch(r"(\d+)\.(\d+)(?:\.\d+)?", cuda_build or "")
    if not match:
        raise IncompatibleGPU("pytorch_must_be_cuda_enabled")
    runtime = (int(match.group(1)), int(match.group(2)))
    major, minor = capability
    if (major, minor) >= (12, 0):
        # RTX PRO 6000 Blackwell (sm_120) requires >= CUDA 12.8 torch binaries.
        if runtime < (12, 8):
            raise IncompatibleGPU("blackwell_requires_pytorch_cu128_or_newer")
        if not any(x in arches for x in ("sm_120", "compute_120")):
            raise IncompatibleGPU("blackwell_arch_sm120_missing_from_torch_binary")
    elif major == 9 and not any(x in arches for x in ("sm_90", "compute_90")):
        raise IncompatibleGPU("hopper_arch_sm90_missing_from_torch_binary")
    elif major == 8 and not any(x.startswith("sm_8") for x in arches):
        raise IncompatibleGPU("ampere_ada_arch_missing_from_torch_binary")
    return {"capability": f"{major}.{minor}", "torchCuda": cuda_build,
            "archSupported": True}


def require_compatible_gpu(torch_module: Any) -> dict[str, Any]:
    """No tokens or private images ever enter the diagnostic response."""
    try:
        if not torch_module.cuda.is_available():
            raise IncompatibleGPU("cuda_device_unavailable")
        capability = tuple(torch_module.cuda.get_device_capability(0))
        arches = list(torch_module.cuda.get_arch_list())
        result = verify_cuda_build(capability, torch_module.version.cuda, arches)
        # Actual CUDA kernel execution catches mismatched or broken GPU setups.
        proof = torch_module.ones((1,), device="cuda").add(1).item()
        torch_module.cuda.synchronize()
        if proof != 2.0:
            raise IncompatibleGPU("cuda_kernel_smoke_test_failed")
        return result
    except IncompatibleGPU:
        raise
    except Exception as exc:
        raise IncompatibleGPU("cuda_kernel_or_driver_unavailable") from exc


def main() -> int:
    try:
        import torch
        result = require_compatible_gpu(torch)
        print(json.dumps({"ok": True, **result, "torch": torch.__version__}))
        return 0
    except (ImportError, IncompatibleGPU) as exc:
        # No secrets, file paths or model artifacts are printed.
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

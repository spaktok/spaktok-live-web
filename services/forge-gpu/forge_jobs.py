"""Async GPU job queue for HD / ultra TRELLIS.2 runs (submit -> poll -> fetch).

Pure Python, no torch import: the generation callable is injected so the
contract is testable on CPU-only CI.

Guarantees:
  * exactly one GPU job runs at a time (shares the server's GPU lock);
  * bounded queue depth, no automatic retries (paid GPU time);
  * source photos live in memory only until their job starts;
  * results are written 0600 inside a private work dir and expire after TTL;
  * clients only ever see sanitized error categories, never messages/paths.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

STATES = ("queued", "running", "succeeded", "failed", "expired")
ERROR_CATEGORIES = (
    "cuda_out_of_memory", "image_or_glb_invalid", "profile_not_permitted",
    "model_access_denied", "cuda_runtime_error", "inference_exception",
)


def categorize(exc: BaseException) -> str:
    message = str(exc).lower()
    if "out of memory" in message:
        return "cuda_out_of_memory"
    if isinstance(exc, PermissionError):
        return "profile_not_permitted"
    if isinstance(exc, ValueError):
        return "image_or_glb_invalid"
    if any(x in message for x in ("gated repo", "403 client error", "401 client error")):
        return "model_access_denied"
    if any(x in message for x in ("cuda error", "cublas", "cudnn")):
        return "cuda_runtime_error"
    return "inference_exception"


@dataclass
class Job:
    id: str
    profile: str
    poly_budget: Optional[int]
    created_at: float
    state: str = "queued"
    photo: Optional[bytes] = field(default=None, repr=False)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    error: Optional[str] = None
    result_bytes: Optional[int] = None
    result_sha256: Optional[str] = None

    def public(self, queue_position: Optional[int] = None) -> dict:
        data = {
            "id": self.id, "state": self.state, "profile": self.profile,
            "polyBudget": self.poly_budget, "createdAt": int(self.created_at),
            "startedAt": int(self.started_at) if self.started_at else None,
            "finishedAt": int(self.finished_at) if self.finished_at else None,
            "error": self.error, "bytes": self.result_bytes,
            "sha256": self.result_sha256,
        }
        if queue_position is not None:
            data["queuePosition"] = queue_position
        return data


class QueueFull(Exception):
    pass


class JobQueue:
    def __init__(self, generate: Callable[[bytes, str, Optional[int], str], bytes], *,
                 workdir: str, gpu_lock: Optional[asyncio.Lock] = None,
                 max_queue: int = 8, ttl_seconds: int = 3600,
                 max_result_bytes: int = 256 * 1024 * 1024,
                 clock: Callable[[], float] = time.time,
                 on_event: Callable[[dict], None] = lambda _e: None):
        if max_queue < 1 or ttl_seconds < 60:
            raise ValueError("invalid_queue_bounds")
        self._generate = generate
        self._workdir = workdir
        self._lock = gpu_lock or asyncio.Lock()
        self._max_queue = max_queue
        self._ttl = ttl_seconds
        self._max_result = max_result_bytes
        self._clock = clock
        self._emit = on_event
        self._jobs: dict[str, Job] = {}
        self._pending: asyncio.Queue[str] = asyncio.Queue()
        self._worker: Optional[asyncio.Task] = None
        os.makedirs(workdir, mode=0o700, exist_ok=True)

    # ---- lifecycle -------------------------------------------------------
    def start(self) -> None:
        if self._worker is None or self._worker.done():
            self._worker = asyncio.get_running_loop().create_task(self._run())

    async def stop(self) -> None:
        if self._worker:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
            self._worker = None

    # ---- public API ------------------------------------------------------
    def submit(self, photo: bytes, profile: str, poly_budget: Optional[int] = None) -> dict:
        self.purge_expired()
        waiting = sum(1 for j in self._jobs.values() if j.state in ("queued", "running"))
        if waiting >= self._max_queue:
            raise QueueFull()
        job = Job(id=secrets.token_urlsafe(18), profile=profile,
                  poly_budget=poly_budget, created_at=self._clock(), photo=photo)
        self._jobs[job.id] = job
        self._pending.put_nowait(job.id)
        self._emit({"event": "spaktok_gpu_job", "job": job.id,
                    "stage": "queued", "profile": profile})
        return job.public(self._position(job.id))

    def status(self, job_id: str) -> Optional[dict]:
        self.purge_expired()
        job = self._jobs.get(job_id)
        if job is None:
            return None
        return job.public(self._position(job_id) if job.state == "queued" else None)

    def result_path(self, job_id: str) -> Optional[str]:
        self.purge_expired()
        job = self._jobs.get(job_id)
        if job is None or job.state != "succeeded":
            return None
        path = self._path(job_id)
        return path if os.path.isfile(path) else None

    def purge_expired(self) -> None:
        now = self._clock()
        for job in self._jobs.values():
            if job.state in ("succeeded", "failed") and job.finished_at and \
                    now - job.finished_at > self._ttl:
                job.state = "expired"
                self._remove_file(job.id)
        for job_id in [k for k, j in self._jobs.items()
                       if j.state == "expired" and now - (j.finished_at or now) > 2 * self._ttl]:
            del self._jobs[job_id]

    # ---- internals -------------------------------------------------------
    def _position(self, job_id: str) -> int:
        queued = sorted((j for j in self._jobs.values() if j.state == "queued"),
                        key=lambda j: j.created_at)
        for index, job in enumerate(queued):
            if job.id == job_id:
                return index + 1
        return 0

    def _path(self, job_id: str) -> str:
        safe = hashlib.sha256(job_id.encode()).hexdigest()
        return os.path.join(self._workdir, f"{safe}.glb")

    def _remove_file(self, job_id: str) -> None:
        try:
            os.remove(self._path(job_id))
        except FileNotFoundError:
            pass

    async def run_one(self, job_id: str) -> None:
        job = self._jobs.get(job_id)
        if job is None or job.state != "queued":
            return
        photo, job.photo = job.photo, None
        async with self._lock:
            job.state, job.started_at = "running", self._clock()
            self._emit({"event": "spaktok_gpu_job", "job": job.id, "stage": "running"})
            try:
                result = await asyncio.to_thread(
                    self._generate, photo, job.profile, job.poly_budget, job.id)
                if not isinstance(result, (bytes, bytearray)) or \
                        not 28 <= len(result) <= self._max_result or result[:4] != b"glTF":
                    raise ValueError("invalid_or_oversized_glb")
                path = self._path(job.id)
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                with os.fdopen(fd, "wb") as handle:
                    handle.write(result)
                job.result_bytes = len(result)
                job.result_sha256 = hashlib.sha256(result).hexdigest()
                job.state = "succeeded"
            except Exception as exc:  # noqa: BLE001 - categorized, never leaked
                job.state, job.error = "failed", categorize(exc)
            finally:
                del photo
                job.finished_at = self._clock()
        self._emit({"event": "spaktok_gpu_job", "job": job.id, "stage": job.state,
                    "error": job.error, "bytes": job.result_bytes})

    async def _run(self) -> None:
        while True:
            job_id = await self._pending.get()
            try:
                await self.run_one(job_id)
            finally:
                self._pending.task_done()

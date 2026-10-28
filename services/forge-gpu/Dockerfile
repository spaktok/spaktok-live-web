# Operator-owned image-to-3D container; not a Rodin wrapper.
# Run: docker build -f services/forge-gpu/Dockerfile -t spaktok-forge-gpu .
# CUDA GPU required at runtime. This builds Python/CUDA extensions, so the
# base image MUST be the CUDA devel variant with nvcc.
# Unverified until built and smoke-tested on real NVIDIA GPU hardware.
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    TOKENIZERS_PARALLELISM=false \
    HF_HOME=/home/forge/.cache/huggingface \
    XDG_CACHE_HOME=/home/forge/.cache \
    PYTHONPATH=/opt/stable-fast-3d \
    OMP_NUM_THREADS=4

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git python3 python3-pip python3-dev \
    build-essential cmake ninja-build libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
# Pin and inspect upstream changes instead of building unreviewed HEAD.
ARG SF3D_COMMIT=ff21fc491b4dc5314bf6734c7c0dabd86b5f5bb2
RUN git clone https://github.com/Stability-AI/stable-fast-3d.git stable-fast-3d \
 && cd stable-fast-3d && git checkout --detach "$SF3D_COMMIT"

RUN python3 -m pip install --upgrade pip setuptools==69.5.1 wheel \
 && python3 -m pip install torch==2.4.1 torchvision==0.19.1 \
      --index-url https://download.pytorch.org/whl/cu121 \
 && python3 -m pip install -r /opt/stable-fast-3d/requirements.txt \
 && python3 -m pip install \
      "fastapi>=0.115,<1" "uvicorn[standard]>=0.30,<1" \
      "python-multipart>=0.0.9,<1"

RUN useradd -m -u 10001 forge \
 && mkdir -p /home/forge/.cache /opt/spaktok \
 && chown -R forge:forge /home/forge /opt/spaktok

COPY --chown=forge:forge services/forge-gpu/server.py /opt/spaktok/server.py
WORKDIR /opt/spaktok
USER forge
# Model weights are gated: download into your own runtime cache after accepting
# the Stability license, using HF_TOKEN only as a runtime secret.
EXPOSE 8000
CMD ["python3","-m","uvicorn","server:app","--host","0.0.0.0",\
     "--port","8000","--workers","1","--no-access-log"]

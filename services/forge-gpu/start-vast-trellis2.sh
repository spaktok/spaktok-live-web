#!/usr/bin/env bash
# Disabled: the creator explicitly opted out of DINOv3.
# TRELLIS.2 requires that encoder for its pretrained image model.
set -euo pipefail
echo >&2 "disabled_by_operator: TRELLIS.2 / DINOv3 is excluded; use start-vast-trellis-v1.sh with original TRELLIS after dedicated environment validation"
exit 2

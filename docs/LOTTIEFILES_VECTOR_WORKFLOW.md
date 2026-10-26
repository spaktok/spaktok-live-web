# Original LottieFiles AI Vector Generator workflow in SpakTok

The LottieFiles AI Vector Generator is a hosted proprietary service:
https://lottiefiles.com/ai-vector-generator

Its public page lets a person create a layered SVG by prompt or reference
image, then export that SVG. **The hosted AI generator itself is not downloaded
or reimplemented.** The public site does not offer an unrestricted source
bundle or generally available generator API for this use.

SpakTok integrates the original exported SVG files as follows:
1. Open LottieFiles with the official link in the photo Story Composer.
2. Create a vector in the original provider UI and export .svg.
3. Use "Import SVG" in SpakTok to upload it into your **device's** browser
   as a Blob URL (no remote uploads).
4. Adjust position and size using the preview controls. The actual SVG
   visual contents are preserved, subject to security validation that
   rejects scripts, external references, foreignObject, and DTD.
5. Save photo Story. The self-contained vector is drawn to the
   same 720x1280 export canvas as the original camera photo and text.

This implements a **static SVG overlay** in the photo Story Composer;
it is not an animation runtime, live camera face-tracking effect, or a
photorealistic 3D GLB mesh. Real 3D AR remains part of FaceMesh3DEngine.

Privacy: only locally imported assets, Blob URL revoked when removed or
on unmount. User must comply with LottieFiles terms and individual asset license.

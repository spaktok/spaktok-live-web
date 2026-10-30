import type {StudioFanoutManifest} from './spaktok-studio-fanout'

/** Objective, user-downloadable evidence. Does NOT score likeness or claim
 * to beat a competitor without a matched-image blind comparison.
 */
export function buildSpaktokQualityEvidence(manifest:StudioFanoutManifest){
 const s=manifest.source
 return {
  schema:'spaktok-3d-quality-evidence-v1' as const,
  generatedAt:new Date().toISOString(),
  asset:{fileName:s.fileName,sha256:s.sha256,bytes:s.bytes},
  measured:{
   triangleCount:s.triangles,
   embeddedTextureImageCount:s.textureImages,
   morphTargetCount:s.morphTargets,
   animationCount:s.animations,
   skinCount:s.skins,
   hasUV:s.uv,
   hasNormals:s.normals,
   hasPBRMaterial:s.pbr,
   pbrSurfaceFidelityVerified:false,
  },
  mobile:{
   under15MiB:s.bytes<=15*1024*1024,
   under150kTriangles:s.triangles<=150_000,
   testedOnAndroid:manifest.review.androidHardwareTested,
  },
  studios:manifest.outputs.map(o=>({
   target:o.target,state:o.state,blockers:o.blockers,
   published:false as const,
  })),
  fidelity:{
   referenceImageSimilarityMeasured:false,
   hiddenSurfaceAccuracyMeasured:false,
   textureArtifactRateMeasured:false,
   visualHumanReviewCompleted:false,
  },
  competitorComparison:{
   comparedWithMatchedRodinReference:false,
   verifiedWinner:null,
   remark:'Number of faces, material flags and file size are not a visual quality ranking.',
  },
  publicReleaseApproved:false as const,
 }
}

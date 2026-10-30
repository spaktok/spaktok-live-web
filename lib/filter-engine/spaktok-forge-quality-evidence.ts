import type {StudioFanoutManifest} from './spaktok-studio-fanout'
import type {StudioTopologyReport} from './spaktok-glb-topology-audit'

/** Objective, user-downloadable evidence. Does NOT score likeness or claim
 * to beat a competitor without a matched-image blind comparison.
 */
export function buildSpaktokQualityEvidence(
 manifest:StudioFanoutManifest,topology?:StudioTopologyReport|null,
){
 const s=manifest.source
 return {
  schema:'spaktok-3d-quality-evidence-v1' as const,
  generatedAt:new Date().toISOString(),
  asset:{fileName:s.fileName,sha256:s.sha256,bytes:s.bytes},
  generationProfile:manifest.project.gpuProfile??null,
  topology:{
   scanStatus:topology?.status??'not-checked',
   reason:topology?.reason??null,
   triangles:topology?.status==='checked'?topology.triangles:null,
   uniqueIndexEdges:topology?.status==='checked'?topology.edges:null,
   boundaryEdges:topology?.status==='checked'?topology.boundaryEdges:null,
   nonManifoldEdges:topology?.status==='checked'?topology.nonManifoldEdges:null,
   degenerateIndexTriangles:topology?.status==='checked'?
    topology.degenerateIndexTriangles:null,
   // Edge incidence with UV seam splits != watertightness certification.
   manifoldCertified:false,
   visualRetopologyApproved:false,
  },
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

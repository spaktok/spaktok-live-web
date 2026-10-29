import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const script=resolve(process.cwd(),'scripts/runpod-forge-one-hour.sh')
describe('RunPod paid one-hour trial safety contract',()=>{
 it('fails closed rather than creating a GPU with an unenforced TTL',()=>{
  const result=spawnSync('bash',[script,'--apply'],{
   encoding:'utf8',
   env:{...process.env,
    RUNPOD_GPU_ID:'NVIDIA RTX PRO 6000 WK',
    RUNPOD_TEMPLATE_ID:'reviewed_test_template',
   },
   timeout:4000,
  })
  expect(result.status).toBe(3)
  expect(result.stdout).toBe('')
  expect(result.stderr).toContain('No GPU has been launched')
 })
 it('disallows the obsolete RunPod auto-termination flags',()=>{
  const source=readFileSync(script,'utf8')
  expect(source).not.toMatch(/^\s*--terminate-after(?:\s|=)/m)
  expect(source).not.toMatch(/^\s*--stop-after(?:\s|=)/m)
  expect(source).toContain('Earlier versions accepted but DID NOT enforce')
 })
 it('produces a dry-run only without accessing RunPod or paid resources',()=>{
  const result=spawnSync('bash',[script,'--dry-run'],{
   encoding:'utf8',
   env:{...process.env,
    RUNPOD_GPU_ID:'NVIDIA RTX PRO 6000 WK',
    RUNPOD_TEMPLATE_ID:'reviewed_test_template',
   },
   timeout:4000,
  })
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('DRY RUN')
  expect(result.stdout).toContain('--min-cuda-version')
  expect(result.stdout).toContain('8000/http')
  expect(result.stdout).toContain('NO GPU launched')
 })
})

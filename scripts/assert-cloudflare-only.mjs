// Guard active Spaktok source and lockfiles against retired Supabase SDK.
import fs from 'node:fs'
import path from 'node:path'
const p=JSON.parse(fs.readFileSync('package.json','utf8'))
const deps={...p.dependencies,...p.devDependencies,...p.optionalDependencies}
const failures=[]
for(const key of Object.keys(deps))
 if(key==='supabase'||key.startsWith('@supabase/'))failures.push('dependency:'+key)
if(fs.existsSync('lib/supabase'))failures.push('retired_lib_supabase_directory')
const banned=[
 /from\s*['"]@supabase\//,
 /\brequire\s*\(\s*['"]@supabase\//,
 /\bimport\s*\(\s*['"]@supabase\//,
 /from\s*['"]@\/lib\/supabase\//,
 /NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY)/,
]
function scan(file){
 if(!fs.existsSync(file))return
 const st=fs.statSync(file)
 if(st.isDirectory()){
  for(const name of fs.readdirSync(file))
   if(!['node_modules','.next','.git','dist','coverage'].includes(name))
    scan(path.join(file,name))
  return
 }
 if(!/\.(ts|tsx|js|cjs|mjs)$/.test(file)||
     /\.test\.(ts|tsx|js|mjs)$/.test(file)||
     file==='scripts/assert-cloudflare-only.mjs')return
 if(banned.some(re=>re.test(fs.readFileSync(file,'utf8'))))
  failures.push('runtime:'+file)
}
for(const root of ['app','components','lib','cloudflare','scripts','middleware.ts','proxy.ts'])scan(root)
for(const lock of ['bun.lock','pnpm-lock.yaml'])
 if(fs.existsSync(lock)&&/@supabase\//.test(fs.readFileSync(lock,'utf8')))
  failures.push('lockfile:'+lock)
if(failures.length){
 console.error('CLOUDFLARE_ONLY_GATE_FAILED:'+failures.join(','))
 process.exit(1)
}
console.log('CLOUDFLARE_ONLY_ACTIVE_DEPENDENCIES_VERIFIED')

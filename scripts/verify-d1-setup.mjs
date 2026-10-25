#!/usr/bin/env node
// Run locally AFTER creating and migrating D1. It prints no secrets.
const required=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_DATABASE_ID','CLOUDFLARE_D1_API_TOKEN',
  'SPAKTOK_AUTH_PEPPER','SPAKTOK_REGISTRATION_CODE'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length){console.error('D1_NOT_CONFIGURED: Missing environment variable names:',missing.join(', '));process.exit(2)}
const account=process.env.CLOUDFLARE_ACCOUNT_ID,db=process.env.CLOUDFLARE_D1_DATABASE_ID;
if(!/^[a-f0-9]{32}$/i.test(account) || !/^[0-9a-f-]{36}$/i.test(db) ||
   process.env.SPAKTOK_AUTH_PEPPER.length<32 ||
   process.env.SPAKTOK_REGISTRATION_CODE.length<12){
 console.error('D1_INVALID_CONFIGURATION: Check IDs and secret length.');process.exit(2)
}
const url=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`;
const requiredColumns={
 auth_users:['password_hash','recovery_hash','auth_version'],
 auth_sessions:['token_hash','user_id','auth_version'],
 profiles:['id','username'],auth_limits:['id','bucket'],
 videos:['id','status'],follows:['follower_id'],comments:['id'],
 messages:['id'],stories:['id'],stream_uploads:['id']
};
async function query(sql){
 const res=await fetch(url,{
   method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}`,'Content-Type':'application/json'},
   body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(10000)
 });
 if(!res.ok)throw new Error('API request rejected: HTTP '+res.status)
 const body=await res.json()
 if(!body.success||!body.result?.[0]?.success)throw new Error('Database query rejected')
 return body.result[0].results||[]
}
try{
 const rows=await query('SELECT name FROM sqlite_master WHERE type = \'table\'')
 const present=new Set(rows.map(r=>r.name))
 for(const [table,cols] of Object.entries(requiredColumns)){
   if(!present.has(table)){console.error('D1_SCHEMA_INCOMPLETE: Missing table:',table);process.exit(1)}
   const details=await query(`PRAGMA table_info(${table})`)
   const found=new Set(details.map(c=>c.name))
   for(const col of cols){if(!found.has(col)){
     console.error('D1_SCHEMA_INCOMPLETE:',table,'needs column',col);process.exit(1)
   }}
 }
 console.log('D1_READY: Database reachable; native auth v1+v2 schema verified.')
 console.log('NEXT: Redeploy Vercel and GET /api/auth/health; run signup/login/logout with a test account.')
}catch{
 console.error('D1_CONNECTION_FAILED: Confirm D1 permission, database ID and network connectivity. No secrets printed.')
 process.exit(1)
}

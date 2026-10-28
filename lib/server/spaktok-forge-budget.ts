/** Operator spend envelope for Spaktok Forge GPU.
 * Number of accepted jobs is not a dollar guarantee: provider-side GPU
 * auto-stop, account budget alerts and serverless scaling remain mandatory.
 */
export const FORGE_OPERATOR_MAX_DAILY_JOBS=200
export function parseForgeDailyJobLimit(raw:string|undefined):number|null{
 if(!raw||!/^[1-9][0-9]{0,2}$/.test(raw))return null
 const value=Number(raw)
 return Number.isSafeInteger(value)&&value<=FORGE_OPERATOR_MAX_DAILY_JOBS?
  value:null
}
/** SQLite performs the user uniqueness and global count check within ONE
 * D1 write statement, protecting against multiple simultaneous requests
 * accidentally exceeding the operator daily submission cap.
 * Intentionally burns the reservation if inference fails or times out;
 * automatic retries could otherwise double GPU charges.
 */
export const FORGE_QUOTA_CLAIM_SQL=`
 INSERT INTO forge_gpu_daily_claims(
  owner_id,day_utc,job_id,image_sha256,status
 ) SELECT ?,?,?,?,'reserved'
 WHERE (SELECT COUNT(*) FROM forge_gpu_daily_claims WHERE day_utc=?) < ?
 ON CONFLICT(owner_id,day_utc) DO NOTHING
 RETURNING job_id
` as const

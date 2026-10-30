/** Local UI preference helpers; not a promise of server-side enforcement. */
export const SPAKTOK_PREFERENCES_KEY='spaktok:device-preferences:v1'
export const SPAKTOK_PREFERENCES_EVENT='spaktok:preferences-updated'
export type DevicePreferences={
 notifications:boolean;darkMode:boolean;dataSaver:boolean;autoPlay:boolean
}
export const DEFAULT_DEVICE_PREFERENCES:DevicePreferences={
 notifications:true,darkMode:true,dataSaver:false,autoPlay:true,
}
export function parseDevicePreferences(raw:string|null):DevicePreferences{
 if(!raw)return {...DEFAULT_DEVICE_PREFERENCES}
 let data:unknown
 try{data=JSON.parse(raw)}catch{return {...DEFAULT_DEVICE_PREFERENCES}}
 if(!data||typeof data!=='object'||Array.isArray(data))
  return {...DEFAULT_DEVICE_PREFERENCES}
 const values=data as Record<string,unknown>
 const result={...DEFAULT_DEVICE_PREFERENCES}
 for(const key of Object.keys(result) as Array<keyof DevicePreferences>){
  if(typeof values[key]==='boolean')result[key]=values[key] as boolean
 }
 return result
}
export function shouldPrecacheVideo(
 prefs:DevicePreferences,connection:{saveData?:boolean;effectiveType?:string}|null,
):boolean{
 return !prefs.dataSaver&&!connection?.saveData&&
  !['slow-2g','2g','3g'].includes(connection?.effectiveType??'')
}

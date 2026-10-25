'use client'
import { useEffect, useState } from 'react'
export interface NativeUser { id:string; email:string; username:string }
export interface AuthState {
  session:{user:NativeUser}|null
  user:NativeUser|null
  isLoading:boolean
  error:string|null
}
export function useAuth(): AuthState & { signOut:()=>Promise<void> } {
  const [state,setState]=useState<AuthState>({session:null,user:null,isLoading:true,error:null})
  useEffect(()=>{
    const controller=new AbortController()
    fetch('/api/native/auth',{cache:'no-store',credentials:'same-origin',signal:controller.signal})
      .then(async (res)=>{
        const data=await res.json() as { configured?:boolean;user?:NativeUser|null }
        if (!res.ok || !data.configured) throw new Error('native_auth_not_configured')
        if (!controller.signal.aborted) setState({
          session:data.user?{user:data.user}:null,
          user:data.user||null,isLoading:false,error:null,
        })
      }).catch((err)=>{
        if (!controller.signal.aborted) setState({
          session:null,user:null,isLoading:false,
          error:err instanceof Error && err.message==='native_auth_not_configured'
            ? 'native_auth_not_configured':'auth_unavailable',
        })
      })
    return ()=>controller.abort()
  },[])
  const signOut=async()=>{
    const response=await fetch('/api/native/auth',{
      method:'POST',headers:{'Content-Type':'application/json'},
      credentials:'same-origin',body:JSON.stringify({action:'logout'}),
    })
    if (!response.ok) throw new Error('logout_failed')
    setState({session:null,user:null,isLoading:false,error:null})
    window.location.assign('/')
  }
  return {...state,signOut}
}

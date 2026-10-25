import {NextResponse} from 'next/server'
/** Replaced by /api/native/chat. Previous Cloudflare Worker-binding prototype is retired. */
export async function GET(){return NextResponse.json({error:'use_native_chat_api'},{status:410})}
export async function POST(){return NextResponse.json({error:'use_native_chat_api'},{status:410})}

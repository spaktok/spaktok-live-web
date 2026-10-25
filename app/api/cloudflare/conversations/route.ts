import {NextResponse} from 'next/server'
/** Replaced by /api/native/chat?mode=conversations. */
export async function GET(){return NextResponse.json({error:'use_native_chat_api'},{status:410})}

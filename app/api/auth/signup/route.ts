import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates a pre-confirmed user so no email round-trip is required.
 * The Supabase built-in mailer only delivers to org addresses and is
 * heavily rate limited, which is unusable for real signups — so we
 * confirm on the server with the service-role key and let the client
 * sign in immediately afterward.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const username = body.username?.trim() ?? "";

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return NextResponse.json(
      { error: "صيغة البريد الإلكتروني غير صحيحة." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: username || undefined,
      display_name: username || undefined,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exist")) {
      return NextResponse.json(
        { error: "هذا البريد مسجّل بالفعل. سجّل الدخول بدلاً من ذلك." },
        { status: 409 },
      );
    }
    if (msg.includes("password")) {
      return NextResponse.json(
        { error: "كلمة المرور ضعيفة جداً." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "تعذّر إنشاء الحساب. حاول مرة أخرى." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

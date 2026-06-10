import { NextResponse } from 'next/server';
import { createUser } from '@/lib/users';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
    };

    const user = await createUser({
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '注册失败';
    const status = message.includes('已注册') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

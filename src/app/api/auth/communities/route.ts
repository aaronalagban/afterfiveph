import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const expected = process.env.COMMUNITIES_PASSWORD;
    if (!expected) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const ok = password.toUpperCase() === expected.toUpperCase();
    return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

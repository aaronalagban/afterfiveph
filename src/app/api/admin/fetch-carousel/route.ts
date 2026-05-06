import { NextResponse } from 'next/server';

// Apify can take 10-20 seconds — extend the serverless timeout
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { password, igPostUrl } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!igPostUrl || typeof igPostUrl !== 'string') {
      return NextResponse.json({ message: 'igPostUrl is required' }, { status: 400 });
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return NextResponse.json({ message: 'APIFY_API_TOKEN not configured' }, { status: 500 });
    }

    // The scraper may have stored the URL with a "#date" fragment — strip it
    const cleanUrl = igPostUrl.split('#')[0];

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [cleanUrl],
          resultsType: 'details',
        }),
      }
    );

    if (!apifyRes.ok) {
      const text = await apifyRes.text();
      throw new Error(`Apify error (${apifyRes.status}): ${text.slice(0, 200)}`);
    }

    const items: any[] = await apifyRes.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ images: [] });
    }

    const post = items[0];
    let images: string[] = [];

    if (Array.isArray(post.childPosts) && post.childPosts.length > 0) {
      images = post.childPosts
        .map((cp: any) => cp.displayUrl as string | undefined)
        .filter((u: unknown): u is string => typeof u === 'string' && Boolean(u));
    } else if (post.displayUrl) {
      images = [post.displayUrl as string];
    }

    return NextResponse.json({ images });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

import {apiRoute, readBody} from '@/lib/cloud-store';
import {safeKey} from '@/lib/cloud-validation';
import {createRecommendations, getRecommendations} from '@/lib/reading-recommendations';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return apiRoute(request, userId => getRecommendations(userId, safeKey(new URL(request.url).searchParams.get('bookId'), 'Book ID')));
}
export async function POST(request: Request) {
  return apiRoute(request, async userId => {
    const body = await readBody(request);
    return createRecommendations(userId, safeKey(body.bookId, 'Book ID'));
  });
}

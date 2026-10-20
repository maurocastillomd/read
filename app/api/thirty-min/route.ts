import {apiRoute, readBody} from '@/lib/cloud-store';
import {safeKey} from '@/lib/cloud-validation';
import {refreshThirtyMin, startThirtyMin} from '@/lib/thirty-min';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return apiRoute(request, async userId => refreshThirtyMin(userId, safeKey(new URL(request.url).searchParams.get('bookId'), 'Book ID')));
}
export async function POST(request: Request) {
  return apiRoute(request, async userId => startThirtyMin(userId, safeKey((await readBody(request)).bookId, 'Book ID')));
}

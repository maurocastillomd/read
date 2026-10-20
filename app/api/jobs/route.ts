import {apiRoute, readBody, saveBook} from '@/lib/cloud-store';
import {safeKey, validateBook} from '@/lib/cloud-validation';
import {refreshJob, startGeneration} from '@/lib/cloud-generation';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return apiRoute(request, async userId => ({job: await refreshJob(userId, new URL(request.url).searchParams.get('bookId') || undefined)}));
}
export async function POST(request: Request) {
  return apiRoute(request, async userId => {
    const body = await readBody(request);
    let bookId = body.bookId;
    if (body.book) { const book = validateBook(body.book); await saveBook(userId, book); bookId = book.id; }
    return {job: await startGeneration(userId, safeKey(bookId, 'Book ID'))};
  });
}

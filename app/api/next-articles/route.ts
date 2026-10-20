import {apiRoute, getBook} from '@/lib/cloud-store';
import {RequestError, safeKey} from '@/lib/cloud-validation';
import {nextArticles} from '@/lib/next-articles.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return apiRoute(request, async userId => {
    const book = await getBook(userId, safeKey(new URL(request.url).searchParams.get('bookId'), 'Book ID'));
    if (!book || book.sourceType !== 'article') throw new RequestError('Next reads are for articles in your library.', 404);
    // The page leaves out anything already on the shelf.
    return {articles: await nextArticles(book)};
  });
}

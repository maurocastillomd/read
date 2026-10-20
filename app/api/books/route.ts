import {apiRoute, getBooks, readBody, saveBook} from "@/lib/cloud-store";
import {validateBook} from "@/lib/cloud-validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiRoute(request, async userId => ({books: await getBooks(userId)})); }
export async function POST(request: Request) { return apiRoute(request, async userId => ({book: await saveBook(userId, validateBook((await readBody(request)).book))})); }

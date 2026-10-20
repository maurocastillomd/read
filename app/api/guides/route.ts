import {apiRoute, getGuides} from "@/lib/cloud-store";
import {safeKey} from "@/lib/cloud-validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiRoute(request, async userId => ({guides: await getGuides(userId, safeKey(new URL(request.url).searchParams.get("bookId"), "Book ID"))})); }

import {apiRoute, importCompanion, readBody} from "@/lib/cloud-store";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return apiRoute(request, async userId => importCompanion(userId, await readBody(request))); }

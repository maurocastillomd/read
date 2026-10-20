import {apiRoute, getState, readBody, stateChanges, writeChanges} from "@/lib/cloud-store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiRoute(request, async userId => ({state: await getState(userId)})); }
export async function PATCH(request: Request) { return apiRoute(request, async userId => { await writeChanges(userId, stateChanges(await readBody(request))); return {state: await getState(userId)}; }); }

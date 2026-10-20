import {apiRoute, readBody} from '@/lib/cloud-store';
import {actOnJob} from '@/lib/cloud-generation';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: {params: Promise<{id: string; action: string}>}) {
  return apiRoute(request, async userId => { await readBody(request); const {id, action} = await context.params; return {job: await actOnJob(userId, id, action)}; });
}

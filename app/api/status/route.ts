import {apiRoute} from '@/lib/cloud-store';
import {generationStatus} from '@/lib/cloud-generation';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return apiRoute(request, async () => generationStatus()); }

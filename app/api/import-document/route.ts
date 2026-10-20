import {apiRoute,readBody,saveBook} from '@/lib/cloud-store';
import {RequestError,validateBook} from '@/lib/cloud-validation';
import {DocumentImportError,importReadingLink} from '@/lib/document-import-url.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  return apiRoute(request,async userId=>{
    const body=await readBody(request);
    try{
      const result=await importReadingLink(body.url) as unknown as {book?:unknown;pdf?:Uint8Array<ArrayBuffer>;sourceUrl?:string;abstractOnly?:boolean};
      // PDFs are read on the device, like an uploaded file, so the Worker stays light.
      if(result.pdf)return new Response(result.pdf,{headers:{'Content-Type':'application/pdf','Cache-Control':'no-store','X-Read-Source-Url':encodeURI(result.sourceUrl||'')}});
      return {book:await saveBook(userId,validateBook(result.book)),...(result.abstractOnly?{abstractOnly:true}:{})};
    }catch(error){
      if(error instanceof DocumentImportError)throw new RequestError(error.message,error.status);
      throw error;
    }
  });
}

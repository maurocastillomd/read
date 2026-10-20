  async function importCompanionFile(file){
    if(!file||importing)return;importing=true;toast('Checking your reading copy…');
    try{
      if(file.size>20*1024*1024)throw new Error('Choose a reading copy under 20 MB.');
      const source=await file.text();let payload;
      if(/\.json$/i.test(file.name)){
        const data=JSON.parse(source);if(data.format!=='margin-library-v1')throw new Error('Choose a read. library backup or portable reading copy.');payload=data;
      }else{
        const template=document.createElement('template');template.innerHTML=source;
        const read=id=>{const node=template.content.querySelector('script#'+id+'[type="application/json"]');return node?JSON.parse(node.textContent):null;};
        const found=read('book-data');if(!found)throw new Error('This file does not contain a read. reading copy.');
        payload={books:Array.isArray(found)?found:[found],guides:read('generated-data')||[],state:read('portable-state')||{}};
      }
      const result=await api('/api/import-companion','POST',payload);
      for(const book of result.books||[]){const index=books.findIndex(b=>b.id===book.id);if(index<0)books.push(book);else books[index]=book;if(db)await dbPut(book).catch(()=>{});}
      await initializeCloudSync();
      if(payload.books?.[0])activeBook=books.find(b=>b.id===payload.books[0].id)||activeBook;
      await refreshGeneration(false);go('library');toast('Imported '+result.imported.books+' books and '+result.imported.guides+' guides.');
    }catch(error){toast(error.message||'The reading copy could not be imported.');}
    finally{importing=false;$('#companion-file').value='';}
  }
  $('#companion-file').addEventListener('change',()=>importCompanionFile($('#companion-file').files[0]));

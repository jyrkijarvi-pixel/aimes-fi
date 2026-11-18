const unique = values => [...new Set(values.filter(Boolean))];

export function combinePhotos(commons,finna) {
  const result=[];
  const ids=new Map();
  let duplicates=0;
  for (const image of [...commons,...finna]) {
    const references=unique([...(image.finnaIds || []),...[image.original,image.url]
      .flatMap(url=>[...String(url || '').matchAll(/finna\.fi\/Record\/([^?#\s]+)/g)].map(match=>{
        try {return decodeURIComponent(match[1]);} catch {return match[1];}
      }))]);
    const same=references.map(id=>ids.get(id)).find(Boolean);
    const item={...image,source:image.source || (/^https?:\/\/(?:www\.)?finna\.fi\//.test(image.original || image.url)?'finna':'commons')};
    if (same) {
      // Keep each record's dating and rights, even when two catalogues describe one photo.
      if (![same,...same.alternatives || []].some(existing=>existing.source===item.source&&existing.url===item.url)) {
        same.alternatives=[...(same.alternatives || []),item];
      }
      duplicates++;
    } else result.push(item);
    for (const id of references) ids.set(id,same || item);
  }
  const commonsPhotos=result.filter(image=>image.source==='commons');
  const finnaPhotos=result.filter(image=>image.source==='finna');
  const photos=[];
  for(let index=0;index<Math.max(commonsPhotos.length,finnaPhotos.length);index++) {
    if(commonsPhotos[index])photos.push(commonsPhotos[index]);
    if(finnaPhotos[index])photos.push(finnaPhotos[index]);
  }
  return {photos,duplicates};
}

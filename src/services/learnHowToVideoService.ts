import { MedialibraryService } from '../generated/services/MedialibraryService';
import type { MedialibraryRead } from '../generated/models/MedialibraryModel';

export interface VideoRecord {
  id: string;
  title: string;
  description: string;
  module: string;
  fileName: string;
  link: string;
  thumbnail: string;
}

function mapFromSharePoint(r: MedialibraryRead): VideoRecord {
  return {
    id: String(r.ID || ''),
    title: r.Title || r['{Name}'] || '',
    description: r.Notes || r.OData__ExtendedDescription || '',
    module: r.Module?.Value || '',
    fileName: r['{FilenameWithExtension}'] || r['{Name}'] || '',
    link: r['{Link}'] || '',
    thumbnail: r['{Thumbnail}']?.Medium || r['{Thumbnail}']?.Small || '',
  };
}

export async function fetchVideosByModule(moduleLabel: string): Promise<VideoRecord[]> {
  console.log('[LearnHowTo] Fetching videos for module:', moduleLabel);
  try {
    const result = await MedialibraryService.getAll();
    console.log('[LearnHowTo] SharePoint getAll result:', JSON.stringify(result).substring(0, 500));
    const records = ((result as any).data || (result as any).value || []) as MedialibraryRead[];
    const all = records.map(mapFromSharePoint);
    console.log('[LearnHowTo] All videos:', all.map(v => `${v.title} [${v.module}]`));
    const filtered = all.filter(v => v.module === moduleLabel);
    console.log('[LearnHowTo] Filtered for', moduleLabel, ':', filtered.length, 'videos');
    return filtered;
  } catch (err: any) {
    console.error('[LearnHowTo] SharePoint fetch failed:', err?.message || err);
    return [];
  }
}

export async function fetchAllVideos(): Promise<VideoRecord[]> {
  try {
    const result = await MedialibraryService.getAll();
    const records = ((result as any).data || []) as MedialibraryRead[];
    return records.map(mapFromSharePoint);
  } catch (err) {
    console.error('[LearnHowTo] SharePoint fetch all failed:', err);
    return [];
  }
}

export function getVideoDirectUrl(videoRecord: VideoRecord): string {
  return videoRecord.link;
}

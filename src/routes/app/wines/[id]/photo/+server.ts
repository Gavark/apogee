import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireCtx } from '$lib/server/context';
import { parseRouteId } from '$lib/server/http';
import { photosDir } from '$lib/server/photos';
import { loadWinePhoto } from './_logic';

export const GET: RequestHandler = ({ params, locals }) => {
  const ctx = requireCtx(locals);
  const id = parseRouteId(params.id);
  const photo = loadWinePhoto(getDb().db, ctx, id, photosDir());
  if (!photo) throw error(404);
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      'Content-Type': photo.mime,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};

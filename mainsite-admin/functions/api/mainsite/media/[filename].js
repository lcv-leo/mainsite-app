// Módulo: mainsite-admin/functions/api/mainsite/media/[filename].js
// Descrição: Serve objetos do R2 (imagens de posts) diretamente no admin
// via binding MEDIA_BUCKET, espelhando a rota do frontend.

const MIME_TYPES = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'avif': 'image/avif',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'pdf': 'application/pdf',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
};

export async function onRequest(context) {
  const { env, params } = context;
  const filename = params.filename;

  if (!filename) {
    return new Response('Arquivo não especificado', { status: 400 });
  }

  const object = await env.MEDIA_BUCKET.get(filename);

  if (!object) {
    return new Response('Arquivo não encontrado', { status: 404 });
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'ETag': object.httpEtag || '',
    },
  });
}

import 'dotenv/config';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLIP_API_KEY'];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'clips';
const PORT = Number(process.env.PORT || 8787);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fastify = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
      : undefined,
  },
  maxParamLength: 2048,
});

fastify.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

fastify.addHook('preHandler', async (req, reply) => {
  const key = req.headers['x-clip-key'];
  if (!key || key !== process.env.CLIP_API_KEY) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});

const parseTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((v) => v.split(',').map((t) => t.trim()).filter(Boolean));
  return value
    .toString()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
};

fastify.get('/health', async () => ({ ok: true, time: new Date().toISOString() }));

fastify.post('/clip', async (req, reply) => {
  const clipId = nanoid();
  const createdAt = new Date().toISOString();
  const clientIp = req.ip;

  const isMultipart = req.isMultipart();
  let payload = {};
  let filePart = null;

  try {
    if (isMultipart) {
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          filePart = part;
        } else if (part.type === 'field') {
          payload[part.fieldname] = part.value;
        }
      }
    } else {
      payload = req.body || {};
    }
  } catch (err) {
    req.log.error({ err }, 'failed to parse payload');
    return reply.code(400).send({ error: 'invalid payload' });
  }

  const content = (payload.content || payload.text || payload.ocr_text || '').toString();
  const note = (payload.note || '').toString();
  const title = (payload.title || '').toString();
  const url = (payload.url || '').toString();
  const kind = (payload.kind || (filePart ? 'file' : 'text')).toString();
  const sourceApp = (payload.source_app || payload.sourceApp || '').toString();
  const device = (payload.device || '').toString();
  const tags = parseTags(payload.tags);

  let fileMeta = null;

  if (filePart) {
    try {
      const buffer = await filePart.toBuffer();
      const filename = filePart.filename || 'upload';
      const filePath = `${clipId}/${filename}`;
      const { error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, buffer, {
          contentType: filePart.mimetype || 'application/octet-stream',
          upsert: false,
        });
      if (error) {
        req.log.error({ error }, 'supabase storage upload failed');
        return reply.code(500).send({ error: 'storage upload failed', details: error.message });
      }
      fileMeta = {
        path: filePath,
        content_type: filePart.mimetype,
        size: buffer.length,
        filename,
      };
    } catch (err) {
      req.log.error({ err }, 'failed to handle file');
      return reply.code(500).send({ error: 'file handling failed' });
    }
  }

  const record = {
    id: clipId,
    title: title || null,
    url: url || null,
    content: content || null,
    note: note || null,
    tags,
    source_app: sourceApp || null,
    device: device || null,
    kind,
    file_path: fileMeta?.path || null,
    file_meta: fileMeta,
    created_at: createdAt,
    client_ip: clientIp,
  };

  const { error } = await supabase.from('clips').insert(record);
  if (error) {
    req.log.error({ error }, 'supabase insert failed');
    return reply.code(500).send({ error: 'db insert failed', details: error.message });
  }

  return {
    id: clipId,
    stored: true,
    has_file: Boolean(fileMeta),
    bucket: SUPABASE_BUCKET,
    created_at: createdAt,
  };
});

fastify.setErrorHandler((err, req, reply) => {
  req.log.error({ err }, 'unhandled error');
  reply.code(500).send({ error: 'internal_error' });
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info({ address, bucket: SUPABASE_BUCKET }, 'clipper listening');
});

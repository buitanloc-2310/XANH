import { HttpError } from './http.js';

const ALLOWED = new Map([
  ['image/jpeg', ['jpg','jpeg']], ['image/png',['png']], ['image/webp',['webp']], ['image/avif',['avif']], ['image/gif',['gif']], ['image/svg+xml',['svg']],
  ['application/pdf',['pdf']], ['text/plain',['txt']], ['text/csv',['csv']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',['docx']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',['xlsx']],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation',['pptx']],
  ['video/mp4',['mp4']], ['video/webm',['webm']]
]);
const MAX_BYTES = 50 * 1024 * 1024;

function extension(name='') { return (name.split('.').pop() || '').toLowerCase(); }
function hex(bytes, n=16) { return [...bytes.slice(0,n)].map(b=>b.toString(16).padStart(2,'0')).join(''); }

function signatureLooksValid(mime, bytes) {
  const h = hex(bytes, 16);
  if (mime === 'image/jpeg') return h.startsWith('ffd8ff');
  if (mime === 'image/png') return h.startsWith('89504e470d0a1a0a');
  if (mime === 'image/gif') return new TextDecoder().decode(bytes.slice(0,6)).match(/^GIF8[79]a$/);
  if (mime === 'image/webp') return new TextDecoder().decode(bytes.slice(0,12)).startsWith('RIFF') && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
  if (mime === 'application/pdf') return new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-';
  if (['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(mime)) return h.startsWith('504b0304');
  return true;
}

function sanitizeSvgText(text) {
  const lower = text.toLowerCase();
  if (/<script\b|on\w+\s*=|javascript:|<foreignobject\b/.test(lower)) throw new HttpError(400, 'SVG chứa nội dung không an toàn.');
  return text.replace(/<\?xml[\s\S]*?\?>/gi, '').trim();
}

export async function validateUpload(file) {
  if (!(file instanceof File)) throw new HttpError(400, 'Không tìm thấy file tải lên.');
  if (file.size <= 0 || file.size > MAX_BYTES) throw new HttpError(413, 'File phải lớn hơn 0 byte và không vượt quá 50 MB.');
  const mime = (file.type || '').toLowerCase();
  const allowedExts = ALLOWED.get(mime);
  if (!allowedExts) throw new HttpError(415, 'Định dạng file chưa được cho phép.');
  const ext = extension(file.name);
  if (!allowedExts.includes(ext)) throw new HttpError(415, 'Phần mở rộng file không khớp định dạng.');
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!signatureLooksValid(mime, buf)) throw new HttpError(415, 'Chữ ký file không khớp định dạng khai báo.');
  let body = buf;
  if (mime === 'image/svg+xml') body = new TextEncoder().encode(sanitizeSvgText(new TextDecoder().decode(buf)));
  return { body, mime, ext, size: body.byteLength };
}

export function mediaKey(id, ext) {
  const date = new Date();
  return `uploads/${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${id}.${ext}`;
}

import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

function htmlDocumento(title: string, body: string): string {
  const safeTitle = title.replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char] || char));
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#27272a;padding:24px;line-height:1.65;background:#fff}h1,h2,h3{color:#801529}table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4e7d2}img{max-width:100%;height:auto}pre{white-space:pre-wrap}</style></head><body><h2>${safeTitle}</h2>${body}</body></html>`;
}

export function DocumentWebView({ uri, title, mimeType, fileName }: { uri: string; title: string; mimeType?: string; isPdf?: boolean; preferNativePdf?: boolean; fileName?: string }) {
  const extension = (fileName || uri.split('?')[0]).split('.').pop()?.toLowerCase() || '';
  const isImage = mimeType?.startsWith('image/');
  const isWord = ['doc', 'docx'].includes(extension) || mimeType?.includes('word');
  const isExcel = ['xls', 'xlsx'].includes(extension) || mimeType?.includes('sheet') || mimeType?.includes('excel');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(isWord || isExcel);

  useEffect(() => {
    let active = true;
    setPreview('');
    setError(false);
    if (!isWord && !isExcel) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    fetch(uri).then((response) => {
      if (!response.ok) throw new Error('No se pudo descargar el documento');
      return response.arrayBuffer();
    }).then(async (buffer) => {
      let body: string;
      if (isWord) body = (await mammoth.convertToHtml({ arrayBuffer: buffer })).value;
      else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        body = workbook.SheetNames.map((name) => `<h3>${name}</h3>${XLSX.utils.sheet_to_html(workbook.Sheets[name])}`).join('');
      }
      if (active) { setPreview(htmlDocumento(title, body || '<p>El documento no contiene texto para mostrar.</p>')); setLoading(false); }
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [uri, title, isWord, isExcel]);

  if (isImage) return <img alt={title} src={uri} style={{ width: '100%', height: 520, objectFit: 'contain' }} />;
  if (error) return <div style={{ height: 520, display: 'grid', placeItems: 'center', color: '#801529' }}>No se pudo mostrar el documento. Comprueba tu conexión e inténtalo de nuevo.</div>;
  if (loading) return <div style={{ height: 520, display: 'grid', placeItems: 'center', color: '#801529' }}>Preparando vista previa...</div>;
  if (preview) return <iframe title={title} srcDoc={preview} style={{ display: 'block', width: '100%', height: '100%', minHeight: 520, border: 0, background: '#f3f4f6' }} />;
  return <iframe title={title} src={uri} style={{ display: 'block', width: '100%', height: '100%', minHeight: 520, border: 0, background: '#f3f4f6' }} />;
}

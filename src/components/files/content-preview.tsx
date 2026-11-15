'use client';
import type { Entry } from '@zip.js/zip.js';
import { ImagePreview } from './image-preview';
import { useEffect, useState } from 'react';
import { Download, File } from 'lucide-react';
import { extensionOf, extensionForMime, rasterTypes } from '@/lib/file-types';
import { bytes } from '@/lib/client';
import { Select } from '@/components/ui/select';
type Preview =
  | { kind: 'text'; text: string; truncated: boolean }
  | { kind: 'sheets'; sheets: { name: string; rows: string[][] }[] }
  | { kind: 'sections'; sections: { title: string; text: string }[] }
  | { kind: 'binary'; text: string };
async function readBounded(
  response: Response,
  limit: number,
  signal: AbortSignal,
) {
  if (!response.ok)
    throw new Error('File access failed. Refresh or download the original.');
  if (!response.body) throw new Error('File data is unavailable.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < limit) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      const next = value.subarray(0, limit - length);
      chunks.push(next);
      length += next.length;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
async function officePreview(
  data: Uint8Array,
  extension: string,
  signal: AbortSignal,
): Promise<Preview> {
  const { ZipReader, Uint8ArrayReader } = await import('@zip.js/zip.js');
  const zip = new ZipReader(new Uint8ArrayReader(data), {
    useWebWorkers: false,
  });
  try {
    const entries: Entry[] = [];
    for await (const entry of zip.getEntriesGenerator()) {
      if (entries.length >= 3000)
        throw new Error('Archive has too many entries for a browser preview.');
      entries.push(entry);
    }
    let budget = 0;
    async function xml(path: string) {
      const entry = entries.find((item) => item.filename === path);
      if (!entry || entry.directory) return null;
      if (entry.uncompressedSize > 4 * 1024 * 1024)
        throw new Error(
          'Preview section exceeds the size limit. Download the original.',
        );
      const chunks: Uint8Array[] = [];
      let size = 0;
      await entry.getData(
        new WritableStream<Uint8Array>({
          write(chunk) {
            signal.throwIfAborted();
            budget += chunk.length;
            size += chunk.length;
            if (budget > 8 * 1024 * 1024 || size > 4 * 1024 * 1024)
              throw new Error('Document exceeds the browser preview limit.');
            chunks.push(chunk);
          },
        }),
        { signal },
      );
      const result = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      const text = new TextDecoder().decode(result);
      if (/<!DOCTYPE|<!ENTITY/i.test(text))
        throw new Error('Unsupported XML declarations. Download the original.');
      const document = new DOMParser().parseFromString(text, 'application/xml');
      if (document.querySelector('parsererror'))
        throw new Error('Document structure could not be read.');
      return document;
    }
    const nodes = (document: Document | Element, tag: string) =>
      Array.from(document.getElementsByTagNameNS('*', tag));
    const paragraphs = (document: Document) =>
      nodes(document, 'p')
        .map((p) =>
          nodes(p, 't')
            .map((t) => t.textContent ?? '')
            .join(''),
        )
        .join('\n');
    if (extension === 'docx') {
      const document = await xml('word/document.xml');
      if (!document) throw new Error('Word content is unavailable.');
      return {
        kind: 'sections',
        sections: [{ title: 'Document', text: paragraphs(document) }],
      };
    }
    if (extension === 'pptx') {
      const slides = entries
        .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.filename))
        .sort(
          (a, b) =>
            Number(a.filename.match(/slide(\d+)/)?.[1]) -
            Number(b.filename.match(/slide(\d+)/)?.[1]),
        )
        .slice(0, 30);
      const sections = [];
      for (const entry of slides) {
        const document = await xml(entry.filename);
        if (document)
          sections.push({
            title: 'Slide ' + (sections.length + 1),
            text: paragraphs(document),
          });
      }
      return { kind: 'sections', sections };
    }
    const shared = await xml('xl/sharedStrings.xml');
    const strings = shared
      ? nodes(shared, 'si').map((item) =>
          nodes(item, 't')
            .map((t) => t.textContent ?? '')
            .join(''),
        )
      : [];
    const workbook = await xml('xl/workbook.xml');
    const relationships = await xml('xl/_rels/workbook.xml.rels');
    const worksheets = workbook
      ? nodes(workbook, 'sheet')
          .flatMap((sheet) => {
            const relationId =
              sheet.getAttribute('r:id') ??
              sheet.getAttributeNS(
                'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'id',
              );
            const relation = relationships
              ? nodes(relationships, 'Relationship').find(
                  (item) =>
                    item.getAttribute('Id') === relationId &&
                    item.getAttribute('TargetMode') !== 'External',
                )
              : null;
            const target = relation?.getAttribute('Target') ?? '';
            const path = target.startsWith('/')
              ? target.slice(1)
              : 'xl/' + target;
            if (
              !path.startsWith('xl/worksheets/') ||
              path.split('/').includes('..')
            )
              return [];
            const entry = entries.find((item) => item.filename === path);
            return entry
              ? [{ entry, name: sheet.getAttribute('name') ?? 'Sheet' }]
              : [];
          })
          .slice(0, 10)
      : [];
    const sheets = [];
    for (const worksheet of worksheets) {
      const document = await xml(worksheet.entry.filename);
      if (!document) continue;
      const rows = nodes(document, 'row')
        .slice(0, 300)
        .map((row) => {
          const values: string[] = [];
          for (const cell of nodes(row, 'c')) {
            const letters =
              cell.getAttribute('r')?.match(/^[A-Z]+/)?.[0] ?? 'A';
            let column = 0;
            for (const letter of letters)
              column = column * 26 + letter.charCodeAt(0) - 64;
            if (column > 40) continue;
            const value = nodes(cell, 'v')[0]?.textContent ?? '';
            values[column - 1] =
              cell.getAttribute('t') === 's'
                ? (strings[Number(value)] ?? '')
                : cell.getAttribute('t') === 'inlineStr'
                  ? nodes(cell, 't')
                      .map((t) => t.textContent ?? '')
                      .join('')
                  : value;
          }
          return Array.from(
            { length: Math.min(40, values.length) },
            (_, i) => values[i] ?? '',
          );
        });
      sheets.push({
        name: worksheet.name,
        rows,
      });
    }
    return { kind: 'sheets', sheets };
  } finally {
    await zip.close();
  }
}
type PreviewProps = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};
export function ContentPreview(props: PreviewProps) {
  return (
    <ContentPreviewBody
      key={
        props.url + ':' + props.name + ':' + props.mimeType + ':' + props.size
      }
      {...props}
    />
  );
}
function ContentPreviewBody({ url, name, mimeType, size }: PreviewProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(0);
  const extension = extensionForMime(mimeType) || extensionOf(name);
  const image = rasterTypes.includes(mimeType);
  const media = mimeType.startsWith('audio/') || mimeType.startsWith('video/');
  useEffect(() => {
    if (image || media || mimeType === 'application/pdf') return;
    const controller = new AbortController();
    async function load() {
      try {
        const office = ['docx', 'xlsx', 'pptx'].includes(extension);
        if (office && size > 20 * 1024 * 1024)
          throw new Error(
            'Office preview is limited to 20 MB. Download the original to view this file.',
          );
        const text =
          mimeType.startsWith('text/') ||
          [
            'json',
            'xml',
            'csv',
            'md',
            'yaml',
            'yml',
            'log',
            'html',
            'svg',
            'js',
            'ts',
            'tsx',
            'jsx',
            'py',
            'sql',
            'css',
            'sh',
            'ini',
            'toml',
          ].includes(extension);
        const limit = office ? 20 * 1024 * 1024 : text ? 512 * 1024 : 1024;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Range: 'bytes=0-' + (Math.min(size, limit) - 1) },
          cache: 'no-store',
        });
        const data = await readBounded(response, limit, controller.signal);
        let result: Preview;
        if (office)
          result = await officePreview(data, extension, controller.signal);
        else if (text) {
          let content = new TextDecoder('utf-8').decode(data);
          if (extension === 'json' && size <= limit) {
            try {
              const parsed: unknown = JSON.parse(content);
              content = JSON.stringify(parsed, null, 2);
            } catch {
              /* Show invalid JSON as plain text. */
            }
          }
          result = { kind: 'text', text: content, truncated: size > limit };
        } else
          result = {
            kind: 'binary',
            text: Array.from(
              { length: Math.ceil(data.length / 16) },
              (_, row) => {
                const chunk = data.slice(row * 16, row * 16 + 16);
                return (
                  (row * 16).toString(16).padStart(8, '0') +
                  '  ' +
                  Array.from(chunk, (byte) =>
                    byte.toString(16).padStart(2, '0'),
                  )
                    .join(' ')
                    .padEnd(47, ' ') +
                  '  ' +
                  Array.from(chunk, (byte) =>
                    byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.',
                  ).join('')
                );
              },
            ).join('\n'),
          };
        if (!controller.signal.aborted) setPreview(result);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : 'Preview could not load.',
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [url, name, mimeType, size, extension, image, media]);
  if (image) return <ImagePreview url={url} name={name} />;
  if (mimeType === 'application/pdf')
    return <iframe title={name} src={url} className="file-pdf-frame" />;
  if (media)
    return (
      <div className="media-stage">
        {mimeType.startsWith('video/') ? (
          <video
            controls
            preload="metadata"
            src={url}
            onError={() =>
              setError(
                'Your browser cannot play this video. Download the original.',
              )
            }
          />
        ) : (
          <audio
            controls
            preload="metadata"
            src={url}
            onError={() =>
              setError(
                'Your browser cannot play this audio. Download the original.',
              )
            }
          />
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    );
  if (error)
    return (
      <div className="empty">
        <File size={32} />
        <h3>Preview unavailable</h3>
        <p role="alert">{error}</p>
        <a className="btn" href={url} download={name}>
          <Download size={16} />
          Download original
        </a>
      </div>
    );
  if (!preview)
    return (
      <div
        className="skeleton"
        style={{ height: 360 }}
        role="status"
        aria-label="Loading preview"
      />
    );
  return (
    <div className="document-preview">
      {preview.kind === 'text' ? (
        <>
          <p className="preview-caption">
            Text preview {preview.truncated ? '(first 512 KB)' : ''}
          </p>
          <pre>{preview.text || 'This file is empty.'}</pre>
        </>
      ) : preview.kind === 'sections' ? (
        <>
          <p className="preview-caption">
            Read-only preview. Text layout is simplified; original formatting,
            media and charts are preserved in the download. Presentations show
            up to 30 slides.
          </p>
          {preview.sections.map((section) => (
            <section key={section.title} className="office-page">
              <h3>{section.title}</h3>
              <pre>{section.text || 'No readable text on this page.'}</pre>
            </section>
          ))}
        </>
      ) : preview.kind === 'sheets' ? (
        <>
          <p className="preview-caption">
            Read-only values: first 10 sheets, 300 rows and 40 columns. Original
            formatting, charts and calculations are available in the download.
          </p>
          <Select
            aria-label="Worksheet"
            value={String(sheet)}
            onChange={(event) => setSheet(Number(event.target.value))}
          >
            {preview.sheets.map((item, index) => (
              <option key={index} value={String(index)}>
                {item.name}
              </option>
            ))}
          </Select>
          <div className="sheet-scroll">
            <table>
              <tbody>
                {preview.sheets[sheet]?.rows.map((row, index) => (
                  <tr key={index}>
                    <th scope="row">{index + 1}</th>
                    {row.map((cell, column) => (
                      <td key={column}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className="preview-caption">
            {extension ? extension.toUpperCase() : 'Binary'} file -{' '}
            {bytes(size)}. Native visual rendering is unavailable; showing the
            first 1 KB of bytes. Download to open in its original application.
          </p>
          <pre>{preview.text}</pre>
        </>
      )}
    </div>
  );
}

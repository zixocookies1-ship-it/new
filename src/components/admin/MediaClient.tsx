'use client';

import { useEffect, useRef, useState } from 'react';

import { adminFetch } from './api';
import { Btn, InlineAlert, PageHeader, Panel, Pill } from './ui';
import { MEDIA_ROLES, type MediaRole } from '@/lib/types';

interface SignatureResponse {
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  timestamp: number;
  role: MediaRole;
}

/**
 * Media library.
 *
 * Uploads are proxied through the server so the file is validated by magic
 * bytes, size-capped and EXIF-stripped. The asset URL is what gets stored —
 * image bytes never enter MongoDB.
 */
export function MediaClient() {
  const [role, setRole] = useState<MediaRole>('gallery');
  const [folder, setFolder] = useState('natures-choice');
  const [uploaded, setUploaded] = useState<
    Array<{ publicId: string; url: string; width: number; height: number; format?: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [cloudinary, setCloudinary] = useState<{ state: 'checking' | 'ready' | 'missing'; detail: string }>({
    state: 'checking',
    detail: '',
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // The signed-params endpoint 503s when Cloudinary is not configured, which is
  // the honest answer for this screen — say so instead of failing on submit.
  useEffect(() => {
    let active = true;
    fetch('/api/admin/media?role=gallery')
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!active) return;
        setCloudinary(
          res.ok
            ? { state: 'ready', detail: 'Uploads are enabled.' }
            : {
                state: 'missing',
                detail:
                  json.error ??
                  'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
              },
        );
      })
      .catch(() => {
        if (active) setCloudinary({ state: 'missing', detail: 'Could not reach the server.' });
      });
    return () => {
      active = false;
    };
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set('file', file);
        form.set('role', role);
        form.set('alt', file.name);
        if (folder) form.set('folder', folder);

        const res = await fetch('/api/admin/media', { method: 'POST', body: form });
        const json = (await res.json()) as {
          ok?: boolean;
          data?: { publicId: string; url: string; width: number; height: number; format?: string };
          error?: string;
        };
        if (!res.ok || json.ok !== true || !json.data) {
          throw new Error(json.error ?? `Upload of ${file.name} failed.`);
        }
        setUploaded((prev) => [json.data!, ...prev]);
      }
      setMessage(`${files.length} image(s) uploaded to Cloudinary.`);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'The upload failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeAsset(publicId: string) {
    if (!window.confirm('Delete this asset from Cloudinary?\n\nAny product or page already using it will show a broken image.')) {
      return;
    }
    const res = await adminFetch<{ removed: boolean }>(
      `/api/admin/media?publicId=${encodeURIComponent(publicId)}`,
      { method: 'DELETE' },
    );
    setUploaded((prev) => prev.filter((a) => a.publicId !== publicId));
    setMessage(res.removed ? 'Asset deleted from Cloudinary.' : 'Cloudinary did not confirm the delete.');
  }

  return (
    <>
      <PageHeader
        title="Media"
        description="Upload product, recipe and lifestyle photography. Files go to Cloudinary; only URLs are stored in the database."
      />

      {failure ? (
        <div className="mb-4">
          <InlineAlert tone="bad" title="Upload failed">
            {failure}
          </InlineAlert>
        </div>
      ) : null}
      {cloudinary.state === 'missing' ? (
        <div className="mb-4">
          <InlineAlert tone="warn" title="Cloudinary is not configured">
            {cloudinary.detail}
          </InlineAlert>
        </div>
      ) : null}
      {message ? (
        <div className="mb-4">
          <InlineAlert tone="good">{message}</InlineAlert>
        </div>
      ) : null}

      <Panel title="Upload">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="media-role" className="mb-1 block text-xs font-semibold text-ink">
              Role
            </label>
            <select
              id="media-role"
              value={role}
              onChange={(e) => setRole(e.target.value as MediaRole)}
              className="block w-full rounded-lg border border-cream-400 bg-white px-3 py-2 text-sm"
            >
              {MEDIA_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="media-folder" className="mb-1 block text-xs font-semibold text-ink">
              Folder
            </label>
            <input
              id="media-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="natures-choice/products"
              className="block w-full rounded-lg border border-cream-400 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="sr-only"
              onChange={(e) => upload(e.target.files)}
            />
            <Btn
              variant="primary"
              onClick={() => inputRef.current?.click()}
              disabled={busy || cloudinary.state !== 'ready'}
            >
              {busy ? 'Uploading…' : 'Choose files'}
            </Btn>
            <Pill tone={cloudinary.state === 'ready' ? 'good' : 'neutral'}>
              {cloudinary.state === 'checking'
                ? 'Checking…'
                : cloudinary.state === 'ready'
                  ? 'Cloudinary connected'
                  : 'Cloudinary missing'}
            </Pill>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          JPEG, PNG, WebP, AVIF or GIF up to 10 MB. Cloudinary re-encodes each upload (max 2400 px,
          auto format, auto quality) and strips EXIF including GPS.
        </p>
      </Panel>

      <Panel title="Uploaded in this session" className="mt-5">
        {!uploaded.length ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Nothing uploaded yet in this session. Images already saved on products, recipes and
            content pages live in their own editors.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {uploaded.map((a) => (
              <li key={a.publicId} className="overflow-hidden rounded-lg border border-cream-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.publicId}
                  width={200}
                  height={150}
                  className="h-28 w-full bg-cream-100 object-cover"
                />
                <div className="p-2">
                  <p className="truncate font-mono text-2xs text-ink-faint" title={a.publicId}>
                    {a.publicId}
                  </p>
                  <p className="text-2xs text-ink-faint">
                    {a.width}×{a.height}
                    {a.format ? ` · ${a.format}` : ''}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Pill tone="jaggery">URL</Pill>
                    <Btn size="sm" variant="danger" onClick={() => void removeAsset(a.publicId)}>
                      Delete
                    </Btn>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
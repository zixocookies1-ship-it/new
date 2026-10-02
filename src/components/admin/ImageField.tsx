'use client';

import clsx from 'clsx';
import { useId, useRef, useState } from 'react';

import { adminFetch, AdminError } from './api';
import { Btn, InlineAlert, inputClass, labelClass } from './ui';
import type { AdminMediaRef } from './types';
import { MEDIA_ROLES, type MediaRole } from '@/lib/types';

interface UploadResponse {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format?: string;
  bytes?: number;
  role: MediaRole;
  alt: string;
}

/**
 * Upload one file to Cloudinary through our server.
 *
 * Bytes go to `/api/admin/media` (multipart) rather than straight from the
 * browser to Cloudinary: the server validates the file by magic bytes, caps the
 * size and strips EXIF/GPS via the Cloudinary transformation. Direct-to-
 * Cloudinary is still available via the signed-params endpoint, but the proxy is
 * the default because it cannot be silently bypassed.
 */
async function uploadFile(file: File, role: MediaRole, alt: string, folder?: string) {
  const form = new FormData();
  form.set('file', file);
  form.set('role', role);
  form.set('alt', alt || file.name);
  if (folder) form.set('folder', folder);

  const res = await fetch('/api/admin/media', { method: 'POST', body: form });
  let json: { ok?: boolean; data?: UploadResponse; error?: string } = {};
  try {
    json = await res.json();
  } catch {
    throw new AdminError('The upload response could not be read.', res.status, 'BAD_RESPONSE');
  }
  if (!res.ok || json.ok !== true || !json.data) {
    throw new AdminError(json.error ?? 'The upload failed.', res.status, 'UPLOAD_FAILED');
  }
  return json.data;
}

function toMediaRef(asset: UploadResponse, order: number, alt: string): AdminMediaRef {
  return {
    publicId: asset.publicId,
    url: asset.url,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    bytes: asset.bytes,
    role: asset.role,
    alt,
    order,
  };
}

function Thumb({
  media,
  onAltChange,
  onRemove,
}: {
  media: AdminMediaRef;
  onAltChange: (alt: string) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-cream-300 bg-cream-50 p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url}
        alt={media.alt}
        width={64}
        height={64}
        className="h-16 w-16 shrink-0 rounded-md border border-cream-300 bg-white object-cover"
      />
      <div className="min-w-0 flex-1">
        <label className={clsx(labelClass, 'text-2xs')} htmlFor={`alt-${media.publicId}`}>
          Alt text <span className="font-normal text-ink-faint">(required — screen readers)</span>
        </label>
        <input
          id={`alt-${media.publicId}`}
          value={media.alt}
          maxLength={240}
          onChange={(e) => onAltChange(e.target.value)}
          className={clsx(inputClass, 'py-1.5 text-xs')}
        />
        <p className="mt-1 truncate font-mono text-2xs text-ink-faint">
          {media.width}×{media.height}
          {media.format ? ` · ${media.format}` : ''} · {media.role}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="self-start rounded-lg border border-cream-300 px-2 py-1 text-2xs font-semibold text-ink-muted hover:border-[#D9B4B4] hover:text-[#8F3333]"
      >
        Remove
      </button>
    </li>
  );
}

/**
 * Ordered image list editor shared by products, bundles, recipes and content.
 *
 * Alt text is mandatory at both ends — the UI blocks removal of an empty alt so
 * a media reference can never be saved without a description.
 */
export function ImageListField({
  label,
  hint,
  value,
  onChange,
  roles = ['gallery'],
  folder,
  max = 20,
}: {
  label: string;
  hint?: string;
  value: AdminMediaRef[];
  onChange: (next: AdminMediaRef[]) => void;
  roles?: MediaRole[];
  folder?: string;
  max?: number;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<MediaRole>(roles[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const added: AdminMediaRef[] = [];
      for (const file of Array.from(files).slice(0, max - value.length)) {
        const asset = await uploadFile(file, role, file.name, folder);
        added.push(toMediaRef(asset, value.length + added.length + 1, file.name));
      }
      if (added.length) onChange([...value, ...added]);
    } catch (err) {
      setError(err instanceof AdminError ? err.message : 'The upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <p className={labelClass}>{label}</p>
      {hint ? <p className="mb-2 text-xs text-ink-muted">{hint}</p> : null}

      {value.length ? (
        <ul className="mb-3 space-y-2">
          {value.map((media) => (
            <Thumb
              key={media.publicId}
              media={media}
              onAltChange={(alt) =>
                onChange(value.map((m) => (m.publicId === media.publicId ? { ...m, alt } : m)))
              }
              onRemove={() => onChange(value.filter((m) => m.publicId !== media.publicId))}
            />
          ))}
        </ul>
      ) : (
        <p className="mb-3 rounded-lg border border-dashed border-cream-400 px-3 py-4 text-center text-xs text-ink-muted">
          No images yet. The storefront shows a neutral placeholder — never a stock photo.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {roles.length > 1 ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MediaRole)}
            aria-label="Image role"
            className={clsx(inputClass, 'w-auto py-1.5 text-xs')}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        ) : null}

        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Btn
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || value.length >= max}
          size="sm"
        >
          {busy ? 'Uploading…' : '+ Add image'}
        </Btn>
        <span className="text-2xs text-ink-faint">
          {value.length}/{max} · stored on Cloudinary, never in the database
        </span>
      </div>

      {error ? (
        <div className="mt-2">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}
    </div>
  );
}

/** Single-image variant (OG image, bundle hero, recipe hero). */
export function ImageField({
  label,
  hint,
  value,
  onChange,
  roles = ['gallery'],
  folder,
}: {
  label: string;
  hint?: string;
  value: AdminMediaRef | null;
  onChange: (next: AdminMediaRef | null) => void;
  roles?: MediaRole[];
  folder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<MediaRole>(roles[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const asset = await uploadFile(file, role, file.name, folder);
      onChange(toMediaRef(asset, 1, file.name));
    } catch (err) {
      setError(err instanceof AdminError ? err.message : 'The upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <p className={labelClass}>{label}</p>
      {hint ? <p className="mb-2 text-xs text-ink-muted">{hint}</p> : null}

      {value ? (
        <div className="mb-2 flex gap-3 rounded-lg border border-cream-300 bg-cream-50 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.url}
            alt={value.alt}
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded-md border border-cream-300 bg-white object-cover"
          />
          <div className="min-w-0 flex-1">
            <label className={clsx(labelClass, 'text-2xs')} htmlFor={`single-alt-${value.publicId}`}>
              Alt text
            </label>
            <input
              id={`single-alt-${value.publicId}`}
              value={value.alt}
              maxLength={240}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
              className={clsx(inputClass, 'py-1.5 text-xs')}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="self-start rounded-lg border border-cream-300 px-2 py-1 text-2xs font-semibold text-ink-muted hover:border-[#D9B4B4] hover:text-[#8F3333]"
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {roles.length > 1 ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MediaRole)}
            aria-label="Image role"
            className={clsx(inputClass, 'w-auto py-1.5 text-xs')}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Btn type="button" onClick={() => fileRef.current?.click()} disabled={busy} size="sm">
          {busy ? 'Uploading…' : value ? 'Replace image' : '+ Upload image'}
        </Btn>
      </div>

      {error ? (
        <div className="mt-2">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}
    </div>
  );
}

/** Delete a Cloudinary asset. Callers warn that database references survive. */
export async function deleteCloudinaryAsset(publicId: string): Promise<boolean> {
  try {
    const res = await adminFetch<{ removed: boolean }>(
      `/api/admin/media?publicId=${encodeURIComponent(publicId)}`,
      { method: 'DELETE' },
    );
    return res.removed;
  } catch {
    return false;
  }
}

export { MEDIA_ROLES };
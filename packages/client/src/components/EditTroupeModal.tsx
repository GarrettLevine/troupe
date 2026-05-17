import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TroupeBadge } from './TroupeBadge';
import { MAX_TROUPE_NAME_LENGTH, BADGE_MAX_FILE_SIZE, BADGE_ACCEPTED_TYPES } from '../lib/constants';

interface EditTroupeModalProps {
  open: boolean;
  onClose: () => void;
  troupeId: string;
  currentName: string;
  hasBadge: boolean;
  updatedAt: string;
  onNameUpdated: (name: string, updatedAt: string) => void;
  onBadgeUploaded: (updatedAt: string) => void;
}

export function EditTroupeModal({
  open,
  onClose,
  troupeId,
  currentName,
  hasBadge,
  updatedAt,
  onNameUpdated,
  onBadgeUploaded,
}: EditTroupeModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(currentName);
  const [nameSubmitting, setNameSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setNameError(null);
      setNameSuccess(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileError(null);
      setUploadSuccess(false);
    }
  }, [open, currentName]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const nameChanged = name.trim() !== currentName;
  const nameValid = name.trim().length > 0 && name.trim().length <= MAX_TROUPE_NAME_LENGTH;

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setNameSubmitting(true);
    setNameError(null);
    setNameSuccess(false);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/troupes/${troupeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: { message: string } };
        throw new Error(data.error?.message ?? 'Failed to update name');
      }
      const updated = (await res.json()) as { name: string; updatedAt: string };
      setNameSuccess(true);
      onNameUpdated(updated.name, updated.updatedAt);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setNameSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setUploadSuccess(false);

    if (!BADGE_ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Only JPEG, PNG, and WebP images are accepted');
      return;
    }
    if (file.size > BADGE_MAX_FILE_SIZE) {
      setFileError('File must be 5MB or smaller');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleBadgeUpload = async () => {
    if (!user || !selectedFile) return;
    setUploading(true);
    setFileError(null);
    setUploadSuccess(false);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('image', selectedFile);
      const res = await fetch(`/api/troupes/${troupeId}/badge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: { message: string } };
        throw new Error(data.error?.message ?? 'Failed to upload badge');
      }
      const data = (await res.json()) as { updatedAt: string };
      setUploadSuccess(true);
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      onBadgeUploaded(data.updatedAt);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to upload badge');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900">Edit Troupe</h2>

        {/* Name section */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-700">Troupe Name</h3>
          <form onSubmit={handleNameSave} className="flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-troupe-name" className="text-xs text-gray-500">
                  Name
                </label>
                <span className="text-xs text-gray-400">
                  {name.length}/{MAX_TROUPE_NAME_LENGTH}
                </span>
              </div>
              <input
                id="edit-troupe-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameSuccess(false); }}
                maxLength={MAX_TROUPE_NAME_LENGTH}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            {nameSuccess && <p className="text-xs text-emerald-600">Name updated</p>}
            <button
              type="submit"
              disabled={nameSubmitting || !nameChanged || !nameValid}
              className="self-end px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {nameSubmitting ? 'Saving…' : 'Save Name'}
            </button>
          </form>
        </section>

        <hr className="border-gray-100" />

        {/* Badge section */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-700">Troupe Badge</h3>

          <div className="flex items-center gap-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Badge preview"
                className="w-16 h-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <TroupeBadge
                troupe={{ id: troupeId, name: currentName, hasBadge, updatedAt }}
                size="thumbnail"
              />
            )}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
              >
                {hasBadge ? 'Replace Photo' : 'Upload Photo'}
              </button>
              <p className="text-xs text-gray-400">JPG, PNG, WebP — max 5MB</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {fileError && <p className="text-xs text-red-600">{fileError}</p>}
          {uploadSuccess && <p className="text-xs text-emerald-600">Badge uploaded</p>}

          {selectedFile && (
            <button
              type="button"
              onClick={handleBadgeUpload}
              disabled={uploading}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                'Upload Badge'
              )}
            </button>
          )}
        </section>

        <button
          type="button"
          onClick={onClose}
          className="self-end text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

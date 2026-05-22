import { useState, useEffect } from 'react';
import { TroupeEvent, UpdateEventData } from '../hooks/useEvents';
import { TroupeRole, EVENT_TYPE_STYLES, MAX_EVENT_NAME_LENGTH, MAX_EVENT_LOCATION_LENGTH, MAX_EVENT_DETAILS_LENGTH, CALL_TIME_OPTIONS, DURATION_OPTIONS } from '../lib/constants';
import { formatEventDate, formatTime, toLocalDatetimeValue, deriveCallTime } from '../lib/utils';

interface EventModalProps {
  event: TroupeEvent;
  troupeId: string;
  currentUserRole: TroupeRole;
  onClose: () => void;
  onUpdated: (event: TroupeEvent) => void;
  onDeleted: (eventId: string) => void;
  onUpdate: (eventId: string, data: UpdateEventData) => Promise<TroupeEvent>;
  onDelete: (eventId: string) => Promise<void>;
}

export function EventModal({
  event,
  currentUserRole,
  onClose,
  onUpdated,
  onDeleted,
  onUpdate,
  onDelete,
}: EventModalProps) {
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'organizer';
  const canDelete = currentUserRole === 'owner';

  const [name, setName] = useState(event.name);
  const [eventType, setEventType] = useState(event.eventType);
  const [eventAt, setEventAt] = useState(toLocalDatetimeValue(event.eventAt));
  const [callTimeOffset, setCallTimeOffset] = useState<number | null>(event.callTimeOffset);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(event.durationMinutes);
  const [location, setLocation] = useState(event.location);
  const [details, setDetails] = useState(event.details ?? '');
  const [status, setStatus] = useState(event.status);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(event.name);
    setEventType(event.eventType);
    setEventAt(toLocalDatetimeValue(event.eventAt));
    setCallTimeOffset(event.callTimeOffset);
    setDurationMinutes(event.durationMinutes);
    setLocation(event.location);
    setDetails(event.details ?? '');
    setStatus(event.status);
  }, [event]);

  const isDirty =
    name !== event.name ||
    eventType !== event.eventType ||
    new Date(eventAt).toISOString() !== event.eventAt ||
    callTimeOffset !== event.callTimeOffset ||
    durationMinutes !== event.durationMinutes ||
    location !== event.location ||
    (details || null) !== event.details ||
    status !== event.status;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!location.trim()) newErrors.location = 'Location is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const patch: UpdateEventData = {};
    if (name !== event.name) patch.name = name.trim();
    if (eventType !== event.eventType) patch.eventType = eventType;
    if (new Date(eventAt).toISOString() !== event.eventAt) patch.eventAt = new Date(eventAt).toISOString();
    if (callTimeOffset !== event.callTimeOffset) patch.callTimeOffset = callTimeOffset;
    if (durationMinutes !== event.durationMinutes) patch.durationMinutes = durationMinutes;
    if (location !== event.location) patch.location = location.trim();
    if ((details || null) !== event.details) patch.details = details.trim() || null;
    if (status !== event.status) patch.status = status;

    try {
      const updated = await onUpdate(event.id, patch);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save changes' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(event.id);
      onDeleted(event.id);
      onClose();
    } catch (err) {
      setErrors({ delete: err instanceof Error ? err.message : 'Failed to delete event' });
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const callTimeDisplay = event.callTime
    ? `${formatTime(event.callTime)} (${event.callTimeOffset} mins before)`
    : null;

  const editDerivedCallTime =
    eventAt && callTimeOffset != null
      ? deriveCallTime(eventAt, callTimeOffset)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        {event.status === 'cancelled' && (
          <div className="bg-red-50 border-b border-red-100 px-6 py-3 rounded-t-2xl">
            <p className="text-sm font-medium text-red-700">This event has been cancelled</p>
          </div>
        )}

        <div className="p-6 flex flex-col gap-4">
          {canEdit ? (
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Event name</label>
                  <span className="text-xs text-gray-400">{name.length}/{MAX_EVENT_NAME_LENGTH}</span>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_EVENT_NAME_LENGTH}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                  {(['scheduled', 'cancelled'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                        status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {status === 'cancelled' && status !== event.status && (
                  <p className="text-xs text-amber-600 mt-1">Members will still be able to see this event as cancelled</p>
                )}
              </div>

              {/* Event type */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Type</label>
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                  {(['rehearsal', 'show'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setEventType(t); if (t === 'rehearsal') setCallTimeOffset(null); }}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        eventType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t === 'rehearsal' ? 'Rehearsal' : 'Show'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & time */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Date & time</label>
                <input
                  type="datetime-local"
                  value={eventAt}
                  onChange={(e) => setEventAt(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              {/* Call time — shows only for shows */}
              {eventType === 'show' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Call time <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={callTimeOffset ?? ''}
                  onChange={(e) => setCallTimeOffset(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                >
                  {CALL_TIME_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {editDerivedCallTime && (
                  <p className="text-xs text-gray-500 mt-1">Cast called at {editDerivedCallTime}</p>
                )}
              </div>
              )}

              {/* Duration */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Duration <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={durationMinutes ?? ''}
                  onChange={(e) => setDurationMinutes(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Location</label>
                  <span className="text-xs text-gray-400">{location.length}/{MAX_EVENT_LOCATION_LENGTH}</span>
                </div>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={MAX_EVENT_LOCATION_LENGTH}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location}</p>}
              </div>

              {/* Details */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    Details <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <span className="text-xs text-gray-400">{details.length}/{MAX_EVENT_DETAILS_LENGTH}</span>
                </div>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={MAX_EVENT_DETAILS_LENGTH}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                />
              </div>

              {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isDirty}
                  className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {canDelete && (
                <div className="border-t border-gray-100 pt-4">
                  {deleteConfirm ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-gray-700">Are you sure? This cannot be undone.</p>
                      {errors.delete && <p className="text-xs text-red-600">{errors.delete}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(false)}
                          disabled={deleting}
                          className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(true)}
                      className="w-full text-sm font-medium text-red-600 hover:text-red-700 py-2 transition-colors"
                    >
                      Delete Event
                    </button>
                  )}
                </div>
              )}
            </form>
          ) : (
            /* View mode */
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900 leading-snug">{event.name}</h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  {event.status === 'cancelled' && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      Cancelled
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EVENT_TYPE_STYLES[event.eventType]}`}>
                    {event.eventType === 'show' ? 'Show' : 'Rehearsal'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-sm text-gray-700">
                <p>{formatEventDate(event.eventAt)}</p>
                {event.eventType === 'show' && callTimeDisplay && (
                  <p className="text-gray-500">Call time: {callTimeDisplay}</p>
                )}
                {event.durationFormatted && (
                  <p className="text-gray-500">Duration: {event.durationFormatted}</p>
                )}
                <p>{event.location}</p>
                {event.details && (
                  <p className="text-gray-600 whitespace-pre-wrap">{event.details}</p>
                )}
                <p className="text-xs text-gray-400">Created by {event.createdBy}</p>
              </div>

              <button
                onClick={onClose}
                className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { CreateEventData, TroupeEvent } from '../hooks/useEvents';
import { MAX_EVENT_NAME_LENGTH, MAX_EVENT_LOCATION_LENGTH, MAX_EVENT_DETAILS_LENGTH } from '../lib/constants';

function getMinDatetime(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const CALL_TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: '15 mins before', value: 15 },
  { label: '30 mins before', value: 30 },
  { label: '45 mins before', value: 45 },
  { label: '1h before', value: 60 },
  { label: '1h 30m before', value: 90 },
  { label: '2h before', value: 120 },
];

const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '1h 30m', value: 90 },
  { label: '2h', value: 120 },
  { label: '2h 30m', value: 150 },
  { label: '3h', value: 180 },
  { label: '3h 30m', value: 210 },
  { label: '4h', value: 240 },
];

interface AddEventModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onCreate: (data: CreateEventData) => Promise<TroupeEvent>;
}

export function AddEventModal({ open, onClose, onCreated, onCreate }: AddEventModalProps) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<'show' | 'rehearsal'>('rehearsal');
  const [eventAt, setEventAt] = useState('');
  const [callTimeOffset, setCallTimeOffset] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setName('');
      setEventType('rehearsal');
      setEventAt('');
      setCallTimeOffset(null);
      setDurationMinutes(null);
      setLocation('');
      setDetails('');
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const derivedCallTime =
    eventAt && callTimeOffset != null
      ? formatTime(new Date(new Date(eventAt).getTime() - callTimeOffset * 60 * 1000))
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!eventAt) newErrors.eventAt = 'Date and time is required';
    if (!location.trim()) newErrors.location = 'Location is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        eventType,
        eventAt: new Date(eventAt).toISOString(),
        callTimeOffset,
        durationMinutes,
        location: location.trim(),
        details: details.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to create event' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add Event</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

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

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Date & time</label>
            <input
              type="datetime-local"
              value={eventAt}
              min={getMinDatetime()}
              onChange={(e) => setEventAt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            {errors.eventAt && <p className="text-xs text-red-600 mt-1">{errors.eventAt}</p>}
          </div>

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
            {derivedCallTime && (
              <p className="text-xs text-gray-500 mt-1">Cast called at {derivedCallTime}</p>
            )}
          </div>
          )}

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
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

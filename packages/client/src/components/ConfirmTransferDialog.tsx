import { useState } from 'react';
import { ManagedMember } from '../hooks/useMembers';

interface Props {
  member: ManagedMember;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export function ConfirmTransferDialog({ member, onConfirm, onCancel, loading }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={!loading ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Transfer ownership to {member.displayName}?
        </h3>
        <p className="text-sm text-gray-500">
          You will become an organizer. This cannot be undone.
        </p>

        {step === 1 ? (
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Transfer Ownership
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-red-600">Are you sure? This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Yes, I'm sure — Transfer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

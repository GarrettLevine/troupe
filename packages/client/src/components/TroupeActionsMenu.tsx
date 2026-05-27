import { useState } from 'react';
import { TroupeRole } from '../lib/constants';

interface Props {
  role: TroupeRole;
  onInvite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageMembers: () => void;
}

export function TroupeActionsMenu({ role, onInvite, onEdit, onDelete, onManageMembers }: Props) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const handle = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className="relative">
      {open && (
        <div className="fixed inset-0 z-10" onClick={close} />
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors text-lg leading-none"
        aria-label="Troupe actions"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[160px] z-20">
          {(role === 'owner' || role === 'organizer') && (
            <button
              onClick={() => handle(onInvite)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Invite Members
            </button>
          )}
          {role === 'owner' && (
            <>
              <button
                onClick={() => handle(onManageMembers)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Manage Members
              </button>
              <button
                onClick={() => handle(onEdit)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Edit Troupe
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => handle(onDelete)}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete Troupe
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

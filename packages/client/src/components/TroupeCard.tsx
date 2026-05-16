import { useNavigate } from 'react-router-dom';
import { TroupeSummary } from '../hooks/useTroupes';
import { TroupeBadge } from './TroupeBadge';

const roleStyles: Record<TroupeSummary['role'], string> = {
  owner: 'bg-violet-100 text-violet-700',
  organizer: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
};

interface TroupeCardProps {
  troupe: TroupeSummary;
}

export function TroupeCard({ troupe }: TroupeCardProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3">
      <TroupeBadge
        troupe={troupe}
        size="thumbnail"
        className="mt-0.5"
      />
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-gray-900 text-sm leading-snug truncate">{troupe.name}</h4>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${roleStyles[troupe.role]}`}
          >
            {troupe.role}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {troupe.memberCount} {troupe.memberCount === 1 ? 'member' : 'members'}
        </p>
        <button
          onClick={() => navigate(`/troupes/${troupe.id}`)}
          className="w-full border border-gray-200 rounded-lg py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          View Troupe
        </button>
      </div>
    </div>
  );
}

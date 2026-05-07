import { TroupeSummary } from '../hooks/useTroupes';

const roleStyles: Record<TroupeSummary['role'], string> = {
  owner: 'bg-violet-100 text-violet-700',
  organizer: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
};

interface TroupeCardProps {
  troupe: TroupeSummary;
}

export function TroupeCard({ troupe }: TroupeCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-gray-900 text-sm leading-snug">{troupe.name}</h4>
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
        disabled
        className="w-full border border-gray-200 rounded-lg py-2 text-xs font-medium text-gray-400 cursor-not-allowed"
      >
        View Troupe
      </button>
    </div>
  );
}

import { AttendanceStatus } from '../hooks/useEvents';

interface Option {
  status: AttendanceStatus;
  label: string;
  activeClass: string;
  inactiveClass: string;
}

const OPTIONS: Option[] = [
  {
    status: 'attending',
    label: 'Attending',
    activeClass: 'bg-green-500 border-green-500 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700',
  },
  {
    status: 'maybe',
    label: 'Maybe',
    activeClass: 'bg-amber-500 border-amber-500 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-700',
  },
  {
    status: 'late',
    label: 'Late',
    activeClass: 'bg-blue-500 border-blue-500 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-700',
  },
  {
    status: 'not_attending',
    label: 'Not Going',
    activeClass: 'bg-red-400 border-red-400 text-white',
    inactiveClass: 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-700',
  },
];

interface AttendanceToggleProps {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
  loading: boolean;
  disabled: boolean;
}

export function AttendanceToggle({ value, onChange, loading, disabled }: AttendanceToggleProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-1.5 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={disabled ? 'Cannot update attendance for a cancelled event' : undefined}
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.status;
        const isSpinning = loading && isActive;
        return (
          <button
            key={opt.status}
            type="button"
            disabled={disabled || loading}
            onClick={() => onChange(isActive ? null : opt.status)}
            className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-1.5
              ${isActive ? opt.activeClass : opt.inactiveClass}
              disabled:cursor-not-allowed`}
          >
            {isSpinning ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

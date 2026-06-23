'use client';

function RailIcon({ type }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'plan') {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 6h3.5a4 4 0 0 1 0 8h-1a4 4 0 0 0 0 8h4.5" />
      </svg>
    );
  }

  if (type === 'recent') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (type === 'saved') {
    return (
      <svg {...common}>
        <path d="M6 4h12v17l-6-4-6 4V4z" />
      </svg>
    );
  }

  if (type === 'ai') {
    return (
      <svg {...common}>
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
        <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
      </svg>
    );
  }

  if (type === 'account') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

function RailButton({ active, label, icon, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`relative flex h-[68px] w-full flex-col items-center justify-center gap-1 border-l-[3px] text-[11px] font-semibold transition ${
        active
          ? 'border-teal-600 bg-teal-50 text-teal-700'
          : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <RailIcon type={icon} />
      <span>{label}</span>
      {badge ? (
        <span className="absolute right-2 top-2 min-w-4 rounded-full bg-teal-600 px-1 text-[10px] leading-4 text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function PlannerRail({
  activeView,
  collapsed,
  hasResults,
  creditStatus,
  onSelectView,
  onToggleCollapse,
  onAccount,
}) {
  const creditCount = creditStatus?.hasActiveSubscription ? 'Pro' : creditStatus?.credits || 0;

  return (
    <aside className="hidden md:flex w-[78px] min-w-[78px] flex-col border-r border-gray-200 bg-white z-[120]">
      <div className="py-2">
        <RailButton
          active={activeView === 'plan'}
          label={hasResults ? 'Results' : 'Plan'}
          icon="plan"
          onClick={() => onSelectView('plan')}
        />
        <RailButton
          active={activeView === 'recent'}
          label="Recent"
          icon="recent"
          onClick={() => onSelectView('recent')}
        />
        <RailButton
          active={activeView === 'saved'}
          label="Saved"
          icon="saved"
          onClick={() => onSelectView('saved')}
        />
        <RailButton
          active={activeView === 'ai'}
          label="AI"
          icon="ai"
          onClick={() => onSelectView('ai')}
        />
      </div>

      <div className="mt-auto border-t border-gray-100 py-2">
        <button
          type="button"
          onClick={onAccount}
          title="Account and credits"
          className="flex h-[68px] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
        >
          <RailIcon type="account" />
          <span>{creditCount}</span>
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Open planner panel' : 'Collapse planner panel'}
          className="flex h-12 w-full items-center justify-center text-gray-400 transition hover:bg-gray-50 hover:text-teal-700"
        >
          <span className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}>
            <RailIcon type="collapse" />
          </span>
        </button>
      </div>
    </aside>
  );
}

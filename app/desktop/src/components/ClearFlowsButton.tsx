interface ClearFlowsButtonProps {
  disabled: boolean;
  onClick: () => void;
}

function TrashIcon(): JSX.Element {
  return (
    <svg className="clear-icon-svg" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3.172a1 1 0 0 0 .707-.293l.828-.828A1 1 0 0 1 8.586 1h2.828a1 1 0 0 1 .707.293l.828.828A1 1 0 0 0 13.328 2H14.5a1 1 0 0 1 1 1zM4.268 4H3v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4H4.268z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ClearFlowsButton({ disabled, onClick }: ClearFlowsButtonProps) {
  return (
    <button
      className="btn btn-clear"
      type="button"
      title="Clear all captured requests"
      disabled={disabled}
      onClick={onClick}
    >
      <TrashIcon />
      <span>Clear</span>
    </button>
  );
}

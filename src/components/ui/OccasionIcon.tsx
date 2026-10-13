export function OccasionIcon({
  kind = "gift",
}: {
  kind?: "gift" | "calendar" | "people" | "giving" | "list";
}) {
  return (
    <svg
      aria-hidden="true"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "giving" ? (
        <>
          <rect x="9" y="3" width="10" height="7" rx="1" />
          <path d="M14 3v7M2 16l4-4h4l3 3h5a2 2 0 0 1 0 4h-7l-5 2-4-5Z" />
          <path d="m2 16 3 5" />
        </>
      ) : kind === "calendar" ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" />
        </>
      ) : kind === "people" ? (
        <>
          <circle cx="7" cy="7" r="3" />
          <circle cx="17" cy="7" r="3" />
          <path d="M2 20v-3a5 5 0 0 1 10 0v3" />
          <path d="M12 20v-3a5 5 0 0 1 10 0v3" />
        </>
      ) : kind === "list" ? (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      ) : (
        <>
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M5 12v9h14v-9m-7-4v13" />
          <path d="M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z" />
        </>
      )}
    </svg>
  );
}

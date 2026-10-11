import styles from "./BrandLogo.module.css";
export function BrandLogo({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <span className={styles.logo}>
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        width="32"
        height="32"
        fill="none"
      >
        <rect width="64" height="64" rx="18" fill="currentColor" />
        <path d="M17 30h30v21H17z" fill="var(--accent)" />
        <rect x="14" y="24" width="36" height="10" rx="3" fill="var(--card)" />
        <path d="M32 25v26" stroke="currentColor" strokeWidth="4" />
        <path
          d="M32 25c-15 0-18-10-11-12 5-2 10 6 11 12Zm0 0c15 0 18-10 11-12-5-2-10 6-11 12Z"
          stroke="var(--card)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      </svg>
      {!iconOnly && <span>Cadéoly</span>}
    </span>
  );
}

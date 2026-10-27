import type { LinkKind } from "@/data/residency";

// The marks of the places people link: drawn plainly in one colour, to sit inside the glass.

type P = { size?: number };

export const LinkedInMark = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="4.6" r="2.3" />
    <rect x="3" y="8.6" width="4" height="12.4" rx="0.6" />
    <path d="M9.6 8.6h3.8v1.8c.6-1.1 2.1-2.1 4-2.1 3.5 0 4.4 2.3 4.4 5.4V21h-4v-6.4c0-1.5-.3-2.8-1.9-2.8-1.7 0-2.3 1.2-2.3 2.8V21h-4z" />
  </svg>
);

export const XMark = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.9 1.2h3.7l-8 9.2L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9zm-1.3 19.4h2L6.5 3.2H4.3z" />
  </svg>
);

export const InstagramMark = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.6" />
    <circle cx="12" cy="12" r="4.4" />
    <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const GitHubMark = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
  </svg>
);

export const SiteMark = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9.4" />
    <path d="M2.6 12h18.8M12 2.6c2.6 2.6 3.8 5.8 3.8 9.4s-1.2 6.8-3.8 9.4c-2.6-2.6-3.8-5.8-3.8-9.4S9.4 5.2 12 2.6z" />
  </svg>
);

export const LinkMark = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </svg>
);

// Onairos: their mark isn't public yet, so a plain ring stands in.
export const OnairosMark = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
  </svg>
);

export const MARKS: Record<LinkKind | "extra", (p: P) => React.ReactNode> = { linkedin: LinkedInMark, x: XMark, instagram: InstagramMark, github: GitHubMark, site: SiteMark, extra: LinkMark };

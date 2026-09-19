import type { SVGProps } from "react";

const paths = {
  menu: "M3 6h18M3 12h18M3 18h18",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  recommend: "M6 3h12M6 21h12M5 6h14v12H5Z M10 9l5 3-5 3Z",
  search: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  user: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 19v-2a4 4 0 0 0-8 0v2M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  close: "m6 6 12 12M6 18 18 6",
  play: "m8 5 11 7-11 7Z",
  pause: "M8 5v14M16 5v14",
  volume: "M3 9h4l5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14",
  muted: "M3 9h4l5-4v14l-5-4H3ZM16 9l5 6M16 15l5-6",
  fullscreen: "M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6",
  theater: "M2 5h20v14H2Z",
  settings:
    "m10 3-1 3-3 1-3 3 2 3 1 3 4 1 2 4 3-2 3-1 1-4 2-3-3-2-1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  comment: "M3 3h18v14H9l-5 4v-4H3ZM7 7h10M7 11h7",
  up: "m5 12 7-7 7 7M12 5v15",
  down: "m5 12 7 7 7-7M12 19V4",
  chevron: "m6 9 6 6 6-6",
  sort: "M3 6h18M3 12h12M3 18h6",
  back: "m12 5-7 7 7 7M5 12h16",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}

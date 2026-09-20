export function BrandLogo({
  background = "light",
}: {
  background?: "light" | "dark";
}) {
  return (
    <svg
      className="brand-mark"
      viewBox="302 44 1321 707"
      aria-hidden="true"
      focusable="false"
    >
      <image
        href={
          background === "dark"
            ? "/brand/logo-dark.png"
            : "/brand/logo-transparent.png"
        }
        width="1937"
        height="812"
      />
    </svg>
  );
}

// 36px blue-circle Facebook "f" logo for the navbar — matches the helper's
// FacebookLogo exactly (circle #1877F2, real FB "f" path).
export default function Logo({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <circle cx="18" cy="18" r="18" fill="#1877F2" />
      <path
        d="M24.5 18H20.5V32H15.5V18H13V13.8H15.5V11C15.5 8.2 17.2 6.5 20.3 6.5C21.8 6.5 22.9 6.6 23.3 6.7V10.2H21.5C20.1 10.2 19.8 10.9 19.8 12V13.8H24.2L23.6 18H24.5Z"
        fill="white"
      />
    </svg>
  );
}
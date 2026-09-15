/**
 * The Xeris asterisk mark, drawn inline so it inherits `currentColor` and stays
 * crisp at any size. Matches /public/mark.svg (used as the favicon).
 */
export const XerisMark = ({ size = 32, className = '', strokeWidth = 52, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 768 768"
    fill="none"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <g
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <path d="M384 40v150" />
      <path d="M384 578v150" />
      <path d="M40 384h150" />
      <path d="M578 384h150" />
      <path d="M192 120l384 528" />
      <path d="M576 120L192 648" />
    </g>
  </svg>
)

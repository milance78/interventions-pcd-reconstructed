import type { SVGProps } from "react";

export const ReactComponent = (
  props: SVGProps<SVGSVGElement>,
) => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <defs>
      <linearGradient
        id="idIconFace"
        x1="12"
        y1="8"
        x2="52"
        y2="56"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#78a8ff" />
        <stop offset="0.34" stopColor="#3478f6" />
        <stop offset="0.72" stopColor="#1f5de0" />
        <stop offset="1" stopColor="#1747b8" />
      </linearGradient>

      <linearGradient
        id="idIconEdge"
        x1="12"
        y1="10"
        x2="50"
        y2="56"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#2f73f3" />
        <stop offset="1" stopColor="#123d9f" />
      </linearGradient>

      <linearGradient
        id="idIconGloss"
        x1="32"
        y1="9"
        x2="32"
        y2="34"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.58" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>

      <filter
        id="idIconShadow"
        x="-30%"
        y="-30%"
        width="160%"
        height="170%"
      >
        <feDropShadow
          dx="0"
          dy="3"
          stdDeviation="2.6"
          floodColor="#0f2f79"
          floodOpacity="0.38"
        />
      </filter>
    </defs>

    <g filter="url(#idIconShadow)">
      <rect
        x="8"
        y="8"
        width="48"
        height="48"
        rx="10"
        fill="url(#idIconEdge)"
      />

      <rect
        x="9.5"
        y="8.5"
        width="45"
        height="44"
        rx="9"
        fill="url(#idIconFace)"
      />

      <path
        d="M18 10H46C50.7 10 54 13.4 54 18V27C45 21.7 21 21.8 10 28V18C10 13.4 13.3 10 18 10Z"
        fill="url(#idIconGloss)"
      />

      <rect
        x="10.5"
        y="10.5"
        width="43"
        height="41"
        rx="8"
        fill="none"
        stroke="#9fc2ff"
        strokeOpacity="0.5"
      />

      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="22"
        fontWeight="800"
        letterSpacing="-0.5"
      >
        ID
      </text>
    </g>
  </svg>
);

export default ReactComponent;
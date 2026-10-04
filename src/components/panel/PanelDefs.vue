<template>
  <defs>
    <linearGradient id="enclosure" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e9e8e3" />
      <stop offset="1" stop-color="#c9c7bf" />
    </linearGradient>
    <linearGradient id="backplate" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b9bcc0" />
      <stop offset="1" stop-color="#9fa3a9" />
    </linearGradient>
    <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef0f2" />
      <stop offset="0.15" stop-color="#c3c7cc" />
      <stop offset="0.5" stop-color="#e6e8eb" />
      <stop offset="0.85" stop-color="#aeb3b9" />
      <stop offset="1" stop-color="#d9dce0" />
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e3e3dd" />
      <stop offset="0.12" stop-color="#f6f6f2" />
      <stop offset="0.88" stop-color="#f2f2ee" />
      <stop offset="1" stop-color="#d6d6cf" />
    </linearGradient>
    <linearGradient id="shoulder" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbfbf8" />
      <stop offset="1" stop-color="#ececE6" />
    </linearGradient>
    <linearGradient id="recess" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfcfc8" />
      <stop offset="1" stop-color="#e2e2dc" />
    </linearGradient>
    <radialGradient id="screw" cx="0.35" cy="0.35" r="0.75">
      <stop offset="0" stop-color="#f4f4f4" />
      <stop offset="0.6" stop-color="#b9b9b4" />
      <stop offset="1" stop-color="#85857f" />
    </radialGradient>
    <linearGradient id="lever-dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a4a47" />
      <stop offset="1" stop-color="#1f1f1d" />
    </linearGradient>
    <linearGradient id="lever-blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4b7bd8" />
      <stop offset="1" stop-color="#1e3f8a" />
    </linearGradient>
    <linearGradient id="lever-violet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8b64d8" />
      <stop offset="1" stop-color="#4c2a91" />
    </linearGradient>
    <linearGradient id="lever-red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e05a4a" />
      <stop offset="1" stop-color="#9b2417" />
    </linearGradient>
    <linearGradient id="lcd" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f2a20" />
      <stop offset="1" stop-color="#08170f" />
    </linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0d27a" />
      <stop offset="0.5" stop-color="#c9a13d" />
      <stop offset="1" stop-color="#9b7a24" />
    </linearGradient>
    <linearGradient id="n-base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b82f6" />
      <stop offset="1" stop-color="#1d4ed8" />
    </linearGradient>
    <pattern id="pe-base" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="16" height="16" fill="#16a34a" />
      <rect width="8" height="16" fill="#facc15" />
    </pattern>
    <pattern id="blank" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#e9e7de" />
      <line x1="0" y1="6" x2="6" y2="0" stroke="#dcd9cd" stroke-width="1" />
    </pattern>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
</template>

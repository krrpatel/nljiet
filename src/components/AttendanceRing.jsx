import React from "react";

export default function AttendanceRing({ percentage, size = 140, stroke = 12, status = "safe" }) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = percentage == null ? 0 : Math.min(100, Math.max(0, percentage));
  const offset = circ - (pct / 100) * circ;
  const colors = { safe: "#10b981", warning: "#f59e0b", critical: "#f43f5e", neutral: "#6366f1" };
  const color = colors[status] || colors.neutral;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold" style={{ color }}>
          {percentage == null ? "—" : `${Math.round(percentage)}%`}
        </span>
      </div>
    </div>
  );
}

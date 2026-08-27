export const profileRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  padding: "15px 16px",
  border: "1px solid rgba(148,163,184,.12)",
  borderRadius: 12,
  background: "rgba(15,23,42,.55)",
};

export const profileLabelStyle = { color: "#94a3b8", fontSize: 13 };

export const profileValueStyle = {
  color: "#e2e8f0",
  fontSize: 14,
  textAlign: "right" as const,
  overflowWrap: "anywhere" as const,
};

export const actionButtonStyle = {
  border: "1px solid rgba(148,163,184,.22)",
  borderRadius: 10,
  padding: "11px 14px",
  background: "rgba(148,163,184,.06)",
  color: "#e2e8f0",
  cursor: "pointer",
  fontWeight: 700,
};

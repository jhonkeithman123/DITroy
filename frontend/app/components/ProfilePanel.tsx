"use client";

import type { ChangeEvent, RefObject } from "react";
import { actionButtonStyle, profileLabelStyle, profileRowStyle, profileValueStyle } from "./styles";

export type ProfilePanelProps = {
  displayName: string;
  userEmail: string;
  authProvider: string;
  accountCreatedAt: string;
  avatarUrl: string;
  avatarBusy: boolean;
  avatarInputRef: RefObject<HTMLInputElement>;
  supabaseConfigured: boolean;
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onChooseAvatar: () => void;
  onSignOut: () => void;
};

export function ProfilePanel({ displayName, userEmail, authProvider, accountCreatedAt, avatarUrl, avatarBusy, avatarInputRef, supabaseConfigured, onAvatarChange, onChooseAvatar, onSignOut }: ProfilePanelProps) {
  const avatarStyle = { background: avatarUrl ? `url(${avatarUrl}) center / cover` : "linear-gradient(135deg,#f59e0b,#ef4444)" };
  return (
    <div className="ditroy-scroll" style={styles.container}>
      <div style={styles.headingRow}>
        <div style={{ ...styles.avatar, ...avatarStyle }}>{avatarUrl ? "" : displayName.charAt(0).toUpperCase()}</div>
        <div><strong>{displayName}</strong><div style={styles.email}>{userEmail || "Local account"}</div></div>
      </div>
      <div style={styles.details}>
        <div style={profileRowStyle}><span style={profileLabelStyle}>Email</span><strong style={profileValueStyle}>{userEmail || "Local development account"}</strong></div>
        <div style={profileRowStyle}><span style={profileLabelStyle}>Authentication</span><strong style={profileValueStyle}>{authProvider}</strong></div>
        <div style={profileRowStyle}><span style={profileLabelStyle}>Created</span><strong style={profileValueStyle}>{accountCreatedAt || "This local session"}</strong></div>
      </div>
      <input ref={avatarInputRef} type="file" accept="image/*" onChange={onAvatarChange} style={{ display: "none" }} />
      <button type="button" disabled={avatarBusy || !supabaseConfigured} onClick={onChooseAvatar} style={{ ...actionButtonStyle, marginTop: 18, opacity: supabaseConfigured ? 1 : 0.5 }}>{avatarBusy ? "Uploading..." : "Change profile picture"}</button>
      <button type="button" onClick={onSignOut} style={{ ...actionButtonStyle, marginTop: 24, borderColor: "rgba(248,113,113,.35)", background: "rgba(248,113,113,.08)", color: "#fecaca" }}>Sign out</button>
    </div>
  );
}

const styles = {
  container: { flex: 1, overflowY: "auto" as const, padding: 26 },
  headingRow: { display: "flex", alignItems: "center", gap: 14, marginBottom: 28 },
  avatar: { display: "grid", placeItems: "center", width: 56, height: 56, borderRadius: "50%", color: "white", fontSize: 20, fontWeight: 700 },
  email: { color: "#94a3b8", fontSize: 12, marginTop: 3 },
  details: { display: "grid", gap: 12, maxWidth: 560 },
};

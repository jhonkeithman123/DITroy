export function HistoryPanel() {
  return (
    <div className="ditroy-scroll" style={styles.container}>
      <div className="ditroy-skeleton" style={styles.heading} />
      {[1, 2, 3].map((item) => (
        <div key={item} className="ditroy-skeleton" style={styles.card} />
      ))}
    </div>
  );
}

const styles = {
  container: { flex: 1, overflowY: "auto" as const, padding: 26 },
  heading: { width: 220, height: 28, borderRadius: 8, marginBottom: 24 },
  card: {
    height: 130,
    marginBottom: 14,
    border: "1px solid rgba(148,163,184,.1)",
    borderRadius: 16,
  },
};

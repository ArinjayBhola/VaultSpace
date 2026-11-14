export default function Loading() {
  return (
    <div aria-label="Loading workspace">
      <div
        className="skeleton"
        style={{ width: 250, height: 32, marginBottom: 30 }}
      />
      <div className="stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 135 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 300 }} />
    </div>
  );
}

export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const terms = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 20) ?? [];
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.join('|')})`, 'giu');
  const words = new Set(terms.map((term) => term.toLocaleLowerCase()));
  return (
    <>
      {text.split(pattern).map((part, index) =>
        words.has(part.toLocaleLowerCase()) ? (
          <mark
            key={index}
            style={{ background: '#fef08a', color: '#713f12', borderRadius: 2 }}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

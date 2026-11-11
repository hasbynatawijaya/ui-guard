import { useEffect, useState } from "react";

export function SearchForm({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/search?q=${query}`).then((r) => r.json()).then(setResults);
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSearch(query); }}>
      <input placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <button type="submit">Search</button>
      <p>{results.length} results</p>
      <ul>
        {results.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </form>
  );
}

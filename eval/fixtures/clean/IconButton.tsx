type Item = { id: string; name: string; thumb: string };

export function ItemList({ items, onRemove }: { items: Item[]; onRemove: (id: string) => void }) {
  return (
    <ul className="item-list">
      {items.map((item) => (
        <li key={item.id} className="item">
          <img src={item.thumb} alt="" width={40} height={40} />
          <span style={{ color: "var(--text)" }}>{item.name}</span>
          <button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
            <TrashIcon />
          </button>
        </li>
      ))}
    </ul>
  );
}

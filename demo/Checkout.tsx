import { useState } from "react";

type Item = { id: string; name: string; qty: number; image: string };

export function Checkout({ items, onRemove, onPay }: { items: Item[]; onRemove: (id: string) => void; onPay: () => void }) {
  const [email, setEmail] = useState("");
  return (
    <section className="checkout">
      <h2 style={{ color: "#111827", fontSize: 22 }}>Your cart</h2>
      <ul>
        {items.map((item, index) => (
          <li key={index} className="row">
            <img src={item.image} alt="" width={48} height={48} />
            <span>{item.name} × {item.qty}</span>
            <button onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
      <input placeholder="Email for receipt" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="pay text-[#16a34a]" onClick={onPay}>Pay now</div>
    </section>
  );
}

import _ from "lodash";

type Product = { id: string; name: string; price: number; image: string; onSale: boolean };

export function ProductCard({ product, onAdd }: { product: Product; onAdd: (id: string) => void }) {
  const price = _.round(product.price, 2);
  return (
    <div className="card" onClick={() => onAdd(product.id)}>
      <img src={product.image} />
      <h3 style={{ color: "#1a1a1a", fontSize: 18 }}>{product.name}</h3>
      <p className={product.onSale ? "price price-red" : "price"}>${price}</p>
      <span className="badge text-[#e11d48]">New</span>
      <button onClick={() => onAdd(product.id)}>
        <CartIcon />
      </button>
    </div>
  );
}

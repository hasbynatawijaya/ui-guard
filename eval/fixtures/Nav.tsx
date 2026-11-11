type Link = { href: string; label: string };

export function Nav({ links, active }: { links: Link[]; active: string }) {
  return (
    <nav>
      {links.map((link) => (
        <a key={link.href} href={link.href} className={link.href === active ? "text-[#2563eb] font-bold" : "text-gray-600"}>
          {link.label}
        </a>
      ))}
      <a onClick={() => window.history.back()}>Back</a>
      <span tabIndex={2}>Skip</span>
    </nav>
  );
}

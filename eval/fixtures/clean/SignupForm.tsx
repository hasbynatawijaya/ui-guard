import debounce from "lodash/debounce";
import { useMemo, useState } from "react";

export function SignupForm({ onCheck }: { onCheck: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const check = useMemo(() => debounce(onCheck, 300), [onCheck]);
  return (
    <form className="stack">
      <label htmlFor="signup-email">Work email</label>
      <input id="signup-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); check(e.target.value); }} />
      <label className="checkbox">
        <input type="checkbox" name="terms" /> I accept the terms
      </label>
      <button type="submit" className="text-sm text-white bg-brand-600">Create account</button>
    </form>
  );
}

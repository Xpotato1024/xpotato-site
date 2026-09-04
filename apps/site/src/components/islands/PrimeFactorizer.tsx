import React, { useMemo, useState } from "react";
import { factorize, formatPrimeFactorization, submitPrimeFactorizerDraft } from "./prime-factorizer-model.js";

export default function PrimeFactorizer() {
  const [draft, setDraft] = useState("360");
  const [value, setValue] = useState(360);
  const factors = useMemo(() => factorize(value), [value]);

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setValue((currentValue) => submitPrimeFactorizerDraft(currentValue, draft));
  };

  return (
    <section aria-labelledby="prime-factorizer-title">
      <h2 id="prime-factorizer-title">素因数分解</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="prime-factorizer-input">2以上の整数</label>
        <input
          id="prime-factorizer-input"
          inputMode="numeric"
          min={2}
          name="value"
          step={1}
          type="number"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">分解する</button>
      </form>
      <output aria-live="polite" aria-atomic="true">
        {factors.length > 0 ? formatPrimeFactorization(value) : "2以上の整数を入力してください。"}
      </output>
    </section>
  );
}

import { useState } from "react";

const factorize = (input: number): readonly number[] => {
  if (!Number.isSafeInteger(input) || input < 2) return [];
  const factors: number[] = [];
  let remainder = input;
  for (let divisor = 2; divisor * divisor <= remainder; divisor += 1) {
    while (remainder % divisor === 0) {
      factors.push(divisor);
      remainder /= divisor;
    }
  }
  if (remainder > 1) factors.push(remainder);
  return factors;
};

export default function PrimeFactorizer() {
  const [value, setValue] = useState("84");
  const number = Number(value);
  const factors = factorize(number);
  return (
    <section aria-labelledby="prime-factorizer-title">
      <h2 id="prime-factorizer-title">素因数分解</h2>
      <label>2以上の整数 <input inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} /></label>
      <output aria-live="polite">{factors.length > 0 ? factors.join(" × ") : "2以上の安全な整数を入力してください"}</output>
    </section>
  );
}

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

function factorize(input: number) {
  if (!Number.isInteger(input) || input < 2) {
    return [];
  }

  const factors: number[] = [];
  let value = input;
  let divisor = 2;

  while (value > 1) {
    while (value % divisor === 0) {
      factors.push(divisor);
      value /= divisor;
    }
    divisor += divisor === 2 ? 1 : 2;
    if (divisor * divisor > value && value > 1) {
      factors.push(value);
      break;
    }
  }

  return factors;
}

export default function PrimeFactorizer() {
  const [draft, setDraft] = useState("360");
  const [value, setValue] = useState(360);

  const factors = useMemo(() => factorize(value), [value]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Number(draft);

    if (Number.isInteger(next) && next > 1) {
      setValue(next);
    }
  }

  return (
    <section className="surface mt-8 p-6">
      <p className="eyebrow">Browser App</p>
      <h3 className="mt-3 font-display text-2xl text-ink">Prime Factorizer</h3>
      <p className="mt-3 text-sm leading-7 text-ink/70">
        WordPress の shortcode を廃止し、Astro 上の island として差し替えた小規模ツールです。
      </p>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <label className="flex-1">
          <span className="mb-2 block text-sm font-medium text-ink">2以上の整数</span>
          <input
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none transition focus:border-accent"
            inputMode="numeric"
            min={2}
            step={1}
            type="number"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button
          className="mt-auto rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-accent"
          type="submit"
        >
          分解する
        </button>
      </form>
      <div className="mt-6 rounded-2xl border border-line/70 bg-paper/70 p-4">
        <p className="text-sm text-ink/55">結果</p>
        <p className="mt-2 text-lg font-semibold text-ink">
          {factors.length > 0 ? `${value} = ${factors.join(" × ")}` : "2以上の整数を入力してください。"}
        </p>
      </div>
    </section>
  );
}

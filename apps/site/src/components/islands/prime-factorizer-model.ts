export const factorize = (input: number): readonly number[] => {
  if (!Number.isInteger(input) || input < 2) return [];

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
};

export const submitPrimeFactorizerDraft = (currentValue: number, draft: string): number => {
  const nextValue = Number(draft);
  return Number.isInteger(nextValue) && nextValue > 1 ? nextValue : currentValue;
};

export const formatPrimeFactorization = (value: number): string => {
  const factors = factorize(value);
  return factors.length > 0 ? `${value} = ${factors.join(" × ")}` : "2以上の整数を入力してください。";
};

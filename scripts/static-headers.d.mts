export interface StaticHeaderRule {
  readonly route: string;
  readonly headers: ReadonlyMap<string, string>;
}
export function parseStaticHeaderRules(source: string): readonly StaticHeaderRule[];
export function headersForPath(pathname: string, rules: readonly StaticHeaderRule[]): Readonly<Record<string, string>>;

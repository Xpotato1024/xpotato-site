export function boundaryContrast(foreground: string, background: string): number;
export function verifyDesignRoleInteraction(options: {
  screenshot?: (name: string) => Promise<void>;
  root: string;
  origin: string;
  send: (method: string, parameters?: Record<string, unknown>) => Promise<unknown>;
  evaluate: (expression: string) => Promise<unknown>;
  until: (check: () => Promise<unknown>, label: string) => Promise<unknown>;
}): Promise<{ coverage: string; viewports: number[][]; reports: unknown[]; siteMatrix: unknown[] }>;

/** Public contact destinations. Never append tool inputs, results or browsing queries. */
export const contactEmail = "321miyuto@xpotato.net";
export const siteIssueUrl = "https://github.com/Xpotato1024/xpotato-site/issues";
export const toolIssueLinks = [
  { toolId: "prime-factorizer", label: "素因数分解の計算機能", href: "https://github.com/Xpotato1024/browser-prime-toolkit/issues" },
] as const;

export const getToolIssueLink = (toolId: string | undefined) => toolIssueLinks.find(link => link.toolId === toolId);

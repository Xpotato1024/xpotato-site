// Generated _headers subset: path rules, optional *, additive headers and one reviewed CSP replacement.
// Duplicate names across matching rules combine; each CSP remains enforced.
export function parseStaticHeaderRules(source) {
  const routes = []; let route, headers, current;
  for (const [index, line] of source.replaceAll('\r\n', '\n').split('\n').entries()) {
    if (line.length > 2000) throw Error('Header line exceeds 2000 characters');
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/u.test(line)) {
      if (!/^\/[A-Za-z0-9/_.~*-]*$/u.test(line.trim())) throw Error('Unsupported generated header rule');
      route = line.trim(); headers = new Map(); current={ route, headers }; routes.push(current);
      if (routes.length > 100) throw Error('Header rule limit exceeded');
      continue;
    }
    if(line.trimStart().startsWith('! ')){
      if(route!=='/tools/prime-factorizer/*'||line.trim()!=='! Content-Security-Policy'||current.removals)throw Error('Unadmitted header detach');
      current.removals=['content-security-policy'];continue;
    }
    const colon = line.indexOf(':');
    if (!headers || colon < 0) throw Error('Malformed header line ' + (index + 1));
    const name = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
    if (!/^[a-z0-9-]+$/u.test(name) || !value || headers.has(name)) throw Error('Invalid or duplicate header for ' + route);
    headers.set(name, value);
  }
  if (new Set(routes.map(item => item.route)).size !== routes.length) throw Error('Duplicate header route');
  for(const rule of routes)if(rule.removals&&!rule.headers.has('content-security-policy'))throw Error('CSP detach requires a full replacement');
  return routes;
}
export function headersForPath(pathname, rules) {
  const result = {};
  for (const rule of rules) {
    const escaped = rule.route.replace(/[.+?^\x24{}()|[\]\\]/gu, '\\$&').replaceAll('*', '.*');
    if (!new RegExp('^' + escaped + '$', 'u').test(pathname)) continue;
    for(const name of rule.removals??[])delete result[name];
    for (const [name, value] of rule.headers) result[name] = result[name] ? result[name] + ', ' + value : value;
  }
  return result;
}

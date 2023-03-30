export function iccRestApiPath(host: string): string {
  if (host.includes('rest/v')) throw new Error('Host should not include api path')
  return host + '/rest/v2'
}

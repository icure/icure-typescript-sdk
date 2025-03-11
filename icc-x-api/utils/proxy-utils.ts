const samRedirectMap = {
  'api.icure.cloud': 'sam.icure.cloud',
  'nightly.icure.cloud': 'nightly-sam.icure.cloud',
}

const kmehrRedirectMap = {
  'api.icure.cloud': 'kmehr.icure.cloud',
  'nightly.icure.cloud': 'nightly-kmehr.icure.cloud',
}

function mapHost(host: string, redirectMap: { [key: string]: string }): string {
  for (const [original, redirect] of Object.entries(redirectMap)) {
    if (host.startsWith(`https://${original}`) || host.startsWith(`wss://${original}`)) {
      return host.replace(RegExp(`^(https|wss)://${original}`), `$1://${redirect}`)
    }
  }
  return host
}

export const mapSamHost = (host: string): string => mapHost(host, samRedirectMap)
export const mapKmehrHost = (host: string): string => mapHost(host, kmehrRedirectMap)

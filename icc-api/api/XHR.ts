export namespace XHR {
  export class Header {
    header: string
    data: string

    constructor(header: string, data: string) {
      this.header = header
      this.data = data
    }
  }

  export class Data {
    status: number
    contentType: string
    body: JSON | Array<JSON> | any //stream bytes|json|array<json>

    constructor(status: number, contentType: string, body: JSON | Array<JSON> | any) {
      this.status = status
      this.contentType = contentType
      this.body = body
    }
  }

  export function sendCommand(
    method: string,
    url: string,
    headers: Array<Header> | null,
    data: string | any = ""
  ): Promise<Data> {
    const contentType =
      headers &&
      headers.find(it => (it.header ? it.header.toLowerCase() === "content-type" : false))
    return fetch(
      url,
      Object.assign(
        {
          method: method,
          credentials: "same-origin",
          headers:
            (headers &&
              headers
                .filter(
                  h => h.header.toLowerCase() !== "content-type" || h.data !== "multipart/form-data"
                )
                .reduce((acc: { [key: string]: string }, h) => {
                  acc[h.header] = h.data
                  return acc
                }, {})) ||
            {}
        },
        method === "POST" || method === "PUT"
          ? {
              body:
                (!contentType || contentType.data) === "application/json"
                  ? JSON.stringify(data)
                  : data
            }
          : {}
      )
    ).then(function(response) {
      if (response.status >= 400) {
        const e = new Error(response.statusText)
        e.status = response.status
        e.code = response.status
        e.headers = response.headers
        throw e
      }
      const ct = response.headers.get("content-type") || "text/plain"
      return (ct === "application/octet-stream"
        ? response.arrayBuffer()
        : ct === "application/json"
          ? response.json()
          : response.text()
      ).then(d => new Data(response.status, ct, d))
    })
  }
}

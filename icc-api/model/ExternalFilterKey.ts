export type ExternalFilterKey = { type: 'string'; key: string } | { type: 'long'; key: number } | { type: 'complexKey'; key: (string | number)[] }

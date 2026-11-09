export class ModuleError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
  }
}

export class ProviderError extends ModuleError {
  constructor(code: string, message: string, public readonly definitive = false) {
    super(502, code, message);
  }
}

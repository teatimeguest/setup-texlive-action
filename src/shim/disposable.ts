import 'core-js/modules/esnext.symbol.async-dispose';
import 'core-js/modules/esnext.symbol.dispose';

declare global {
  interface SymbolConstructor {
    readonly asyncDispose: unique symbol;
    readonly dispose: unique symbol;
  }

  interface Disposable {
    [Symbol.dispose](): void;
  }

  interface AsyncDisposable {
    [Symbol.asyncDispose](): Promise<void>;
  }
}

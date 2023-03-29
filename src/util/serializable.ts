import { type ClassTransformOptions, instanceToPlain } from 'class-transformer';

export abstract class Serializable {
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  toPlain(options?: ClassTransformOptions): object {
    return instanceToPlain(this, { strategy: 'excludeAll', ...options });
  }

  toJSON(): object {
    return this.toPlain();
  }
}

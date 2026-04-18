import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidHhmm } from '../utils/time.util';

@ValidatorConstraint({ name: 'IsHhmmTime', async: false })
export class IsHhmmTimeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidHhmm(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} deve estar no formato HH:mm com hora entre 00-23 e minuto entre 00-59.`;
  }
}

export function IsHhmmTime(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsHhmmTimeConstraint,
    });
  };
}

import { Request } from 'express';
import { Result } from '../../../utils/Result';
import { Guard } from '../../../utils/Guard';

export interface ValidationRule {
  field: string;
  rules: ValidationCheck[];
}

interface ValidationCheck {
  check: (value: any) => boolean;
  message: string;
}

export class RequestValidator {
  private rules: ValidationRule[] = [];

  public addRule(field: string, ...checks: ValidationCheck[]): this {
    this.rules.push({ field, rules: checks });
    return this;
  }

  public static string(field: string): ValidationBuilder {
    return new ValidationBuilder(field);
  }

  public static number(field: string): ValidationBuilder {
    return new ValidationBuilder(field)
      .addCheck(
        (value) => !isNaN(Number(value)),
        'Must be a valid number'
      );
  }

  public static email(field: string): ValidationBuilder {
    return new ValidationBuilder(field)
      .addCheck(
        (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        'Must be a valid email'
      );
  }

  public validate(req: Request): Result<any> {
    const errors: string[] = [];

    for (const { field, rules } of this.rules) {
      const value = req.body[field];

      // Check if field exists when required
      const isRequired = rules.some(rule => rule.check === ((value: any) => Guard.againstNullOrUndefined(value, field).succeeded));
      if (isRequired && (value === undefined || value === null)) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip other validations if field is not required and empty
      if (!isRequired && (value === undefined || value === null)) {
        continue;
      }

      // Apply all validation rules
      for (const { check, message } of rules) {
        if (!check(value)) {
          errors.push(`${field}: ${message}`);
        }
      }
    }

    if (errors.length > 0) {
      return Result.fail(errors);
    }

    return Result.ok();
  }
}

class ValidationBuilder {
  private rules: ValidationCheck[] = [];

  constructor(private field: string) {}

  public required(): this {
    this.rules.push({
      check: (value: any) => Guard.againstNullOrUndefined(value, this.field).succeeded,
      message: 'Is required'
    });
    return this;
  }

  public minLength(length: number): this {
    this.rules.push({
      check: (value: string) => value.length >= length,
      message: `Must be at least ${length} characters`
    });
    return this;
  }

  public maxLength(length: number): this {
    this.rules.push({
      check: (value: string) => value.length <= length,
      message: `Must be no more than ${length} characters`
    });
    return this;
  }

  public pattern(regex: RegExp, message: string): this {
    this.rules.push({
      check: (value: string) => regex.test(value),
      message
    });
    return this;
  }

  public addCheck(check: (value: any) => boolean, message: string): this {
    this.rules.push({ check, message });
    return this;
  }

  public build(): ValidationRule {
    return { field: this.field, rules: this.rules };
  }
}
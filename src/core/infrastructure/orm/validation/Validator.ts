import { ValidationRule, ValidationRules } from "../types";

export class ValidationError extends Error {
    constructor(public errors: { [key: string]: string[] }) {
      super('Validation failed');
    }
}
  
export class Validator {
    private static defaultRules: { [key: string]: ValidationRule | Function } = {
      required: {
        validator: (value: any) => value !== undefined && value !== null && value !== '',
        message: 'This field is required'
      },
      string: {
        validator: (value: any) => typeof value === 'string',
        message: 'This field must be a string'
      },
      number: {
        validator: (value: any) => typeof value === 'number',
        message: 'This field must be a number'
      },
      email: {
        validator: (value: any) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return typeof value === 'string' && emailRegex.test(value);
        },
        message: 'This field must be a valid email'
      },
      min: (min: number) => ({
        validator: (value: any) => {
          if (typeof value === 'number') return value >= min;
          if (typeof value === 'string') return value.length >= min;
          if (Array.isArray(value)) return value.length >= min;
          return false;
        },
        message: `This field must be at least ${min}`
      }),
      max: (max: number) => ({
        validator: (value: any) => {
          if (typeof value === 'number') return value <= max;
          if (typeof value === 'string') return value.length <= max;
          if (Array.isArray(value)) return value.length <= max;
          return false;
        },
        message: `This field must be at most ${max}`
      })
    };
  
    static async validate(data: any, rules: ValidationRules): Promise<void> {
      const errors: { [key: string]: string[] } = {};
  
      for (const [field, fieldRules] of Object.entries(rules)) {
        const value = data[field];
        const fieldErrors: string[] = [];
  
        for (const rule of fieldRules) {
          try {
            const isValid = await rule.validator(value);
            if (!isValid) {
              fieldErrors.push(rule.message);
            }
          } catch (error) {
            fieldErrors.push(rule.message);
          }
        }
  
        if (fieldErrors.length > 0) {
          errors[field] = fieldErrors;
        }
      }
  
      if (Object.keys(errors).length > 0) {
        throw new ValidationError(errors);
      }
    }
}

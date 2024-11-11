import { ValidationRules } from "../types";
import { Validator } from "./Validator";

export function validate(rules: ValidationRules) {
    return function (target: any) {
      const originalSave = target.prototype.save;
  
      target.prototype.save = async function (this: any) {
        await Validator.validate(this, rules);
        return originalSave.call(this);
      };
    };
}
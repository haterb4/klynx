import { BaseError } from "../../../utils/BaseError";
import { glob } from "glob";
import path from "path";

export class ComponentRegisterError extends BaseError {
    constructor(message: string) {
      super('ComponentRegisterError', 500, true, message);
    }
}

export class RegisterComponents {
    public static async registerComponent(
        pattern: string,
        label: string = 'Component'
    ): Promise<Record<string, any>> {
        const matchFiles = glob?.sync(pattern);
        const resolvedModules: Record<string, any> = {}
        for (const file of matchFiles) {
            try {
                const matchedModule = await import(path.resolve(file));
                const matchedClass = matchedModule.default || Object.values(matchedModule)[0];

                if (!matchedClass) {
                    throw new ComponentRegisterError(`No ${label} found in ${file}`);
                }

                const matchedName = matchedClass.name.charAt(0).toLowerCase() + matchedClass.name.slice(1);
                
                resolvedModules[matchedName] = matchedClass
            } catch (error) {
                console.error(`Error loading ${label} from ${file}:`, error);
                if (error instanceof Error) {
                    throw new ComponentRegisterError(`Failed to load ${label} from ${file}: ${error.message}`);
                } else {
                    throw new ComponentRegisterError(`Failed to load ${label} from ${file}: ${String(error)}`);
                }
            }
        }

        return resolvedModules

    }
}

export const registerComponents = RegisterComponents.registerComponent;
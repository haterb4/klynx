import { HookFunction, ModelHooks } from "../types";

export class HookStore {
    private static instance: HookStore
    private hooks: Map<string, ModelHooks> = new Map();

    private constructor() {}

    static getInstance(): HookStore {
        if (!HookStore.instance) {
            HookStore.instance = new HookStore();
        }
        return HookStore.instance;
    }

    protected registerHook(modelName: string, type: keyof ModelHooks, fn: HookFunction): void {
        const modelHooks = this.hooks.get(modelName) || {};
        
        if (!this.hooks.has(modelName)) {
          this.hooks.set(modelName, modelHooks);
        }
    
        if (!modelHooks[type]) {
          modelHooks[type] = [];
        }
    
        modelHooks[type]!.push(fn);
    }
}
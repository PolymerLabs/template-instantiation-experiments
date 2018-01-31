import { TemplateAssembly } from '../../template-instantiation/lib/template-assembly.js';
import { TemplateInstance } from '../../template-instantiation/lib/template-instance.js';
import {
  TemplatePart,
  AttributeTemplatePart,
  NodeTemplatePart
} from '../../template-instantiation/lib/template-part.js';
import {
  AttributeTemplateRule,
  NodeTemplateRule
} from '../../template-instantiation/lib/template-rule.js';

const $previousValue = Symbol('previousValue');

export class LtiTemplateProcessor {
  processCallback(parts: TemplatePart[], state?: any): void {
    for (const part of parts) {
      const { rule } = part;

      if (part instanceof NodeTemplatePart) {
        const { expression } = rule as NodeTemplateRule;

        this.processNodePart(part, state && state[expression]);
      } else if (part instanceof AttributeTemplatePart) {
        const { expressions } = rule as AttributeTemplateRule;

        this.processAttributePart(part,
            expressions.map(expression => state && state[expression]));
      }
    }
  }

  protected processAttributePart(part: AttributeTemplatePart, value: any) {
    part.value = value;
  }

  protected processNodePart(part: NodeTemplatePart, value: any) {
    if (value === null ||
        !(typeof value === 'object' || typeof value === 'function')) {
      // Handle primitive values
      // If the value didn't change, do nothing
      if (value === part.value) {
        return;
      }

      part.value = value;
    } else if (value instanceof TemplateAssembly) {
      this.assignTemplateAssemblyValue(part, value);
    } else if (Array.isArray(value) || value[Symbol.iterator] != null) {
      this.assignIterableValue(part, value);
    } else {
      (part as any)[$previousValue] = null;

      if (value instanceof Node) {
        part.replace(value);
      } else {
        // Fallback, will render the string representation
        part.value = value;
      }
    }
  }

  protected assignTemplateAssemblyValue(part: NodeTemplatePart,
      value: TemplateAssembly) {
    const { definition, state, processor } = value;
    let instance: TemplateInstance = (part as any)[$previousValue];

    if (instance != null &&
        instance.definition === definition &&
        instance.processor === processor) {
      instance.update(state);
    } else {
      instance = new TemplateInstance(definition, processor, state);
      // NOTE(cdata): rniwa calls for explicit non-support of DocumentFragment
      // here, should look into why...
      part.replace(...instance.childNodes);
      (part as any)[$previousValue] = instance;
    }
  }

  protected assignIterableValue(part: NodeTemplatePart, value: Iterable<any>) {
    const iterableParts = (part as any)[$previousValue] || [];
    let lastItemPart: NodeTemplatePart | null = null;
    let partIndex = 0;

    for (const item of value) {
      let itemPart = iterableParts[partIndex];

      if (itemPart == null) {
        itemPart = partIndex === 0
            ? part.enclose()
            : lastItemPart!.fork();

        iterableParts.push(itemPart);
      }

      this.processNodePart(itemPart, item);

      lastItemPart = itemPart;
      partIndex++;
    }

    if (partIndex === 0) {
      part.clear();
      (part as any)[$previousValue] = null;
    } else {
      const lastPart = iterableParts[partIndex - 1];
      iterableParts.length = partIndex;
      part.clear(lastPart.nextSibling);
      lastPart.setStart(lastPart.node);
    }
  }
};

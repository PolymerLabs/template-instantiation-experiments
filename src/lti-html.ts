/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import { TemplateAssembly } from '../../template-instantiation/lib/template-assembly.js';
import { TemplateDefinition } from '../../template-instantiation/lib/template-definition.js';
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


/**
 * Below is the `LtiTemplateProcessor`, which is the aspect of implementation
 * most distinct from the original lit-html implementation. The template
 * processor as implemented is similar to some of lit-html's `NodePart`.
 * @see https://github.com/Polymer/lit-html/blob/master/src/lit-html.ts#L421-L574
 */

const $previousValue = Symbol('previousValue');

export class LtiTemplateProcessor {
  processCallback(parts: TemplatePart[], state?: any): void {
    for (const part of parts) {
      const { rule } = part;

      if (part instanceof NodeTemplatePart) {
        const { expression } = rule as NodeTemplateRule;

        this.processNodeTemplatePart(part, state && state[expression]);
      } else if (part instanceof AttributeTemplatePart) {
        const { expressions } = rule as AttributeTemplateRule;

        this.processAttributeTemplatePart(part,
            expressions.map(expression => state && state[expression]));
      }
    }
  }

  protected processAttributeTemplatePart(part: AttributeTemplatePart,
      value: any) {
    part.value = value;
  }

  protected processNodeTemplatePart(part: NodeTemplatePart, value: any) {
    if (value === null && (part as any)[$previousValue] !== null) {
      part.clear();
      (part as any)[$previousValue] = value;
    } else if (!(typeof value === 'object' || typeof value === 'function')) {
      // Handle primitive values
      // If the value didn't change, do nothing
      if (value === part.value) {
        return;
      }

      part.value = value;
      (part as any)[$previousValue] = value;
    } else if (value instanceof TemplateAssembly) {
      this.assignTemplateAssemblyValue(part, value);
    } else if (Array.isArray(value) || value[Symbol.iterator] != null) {
      this.assignIterableValue(part, value);
    } else {
      if (value instanceof Node) {
        part.replace(value);
      } else {
        // Fallback, will render the string representation
        part.value = value;
      }

      (part as any)[$previousValue] = value;
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

      this.processNodeTemplatePart(itemPart, item);

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


/**
 * `html` and `render` are implemented here in a fashion that is closely
 * comparable to the original lit-html implementation. Mostly just names have
 * been altered to line up with domain names used in the Template Instantiation
 * prollyfill.
 */

// TODO(cdata): need envCachesTemplates check for x-browser compatibility
// @see https://github.com/Polymer/lit-html/blob/master/src/lit-html.ts#L15-L23

const definitions = new Map<TemplateStringsArray|string, TemplateDefinition>();
const processor = new LtiTemplateProcessor();

export const html = (strings: TemplateStringsArray, ...values: any[]) =>
    ltiTag(strings, values);

function ltiTag(strings: TemplateStringsArray, values: any[]): TemplateAssembly {
  let definition = definitions.get(strings);

  if (definition == null) {
    const template = document.createElement('template');
    template.innerHTML = values.reduceRight((html, _, index) => {
      return strings[index] + `{{${index}}}` + html;
    }, strings[strings.length - 1]);

    definition = new TemplateDefinition(template);
    definitions.set(strings, definition);
  }

  return new TemplateAssembly(definition, processor, values);
}

export const render = (assembly: TemplateAssembly, container: Element) => {
  const { definition, state, processor } = assembly;
  let instance = (container as any).__templateInstance as TemplateInstance;

  if (instance != null &&
      instance.definition === definition &&
      instance.processor === processor) {
    instance.update(state);
    return;
  }

  instance = new TemplateInstance(definition, processor, state);
  (container as any).__templateInstance = instance;

  removeNodes(container, container.firstChild);
  container.appendChild(instance);
};

// Ripped strait out of lit-html
// @see https://github.com/Polymer/lit-html/blob/master/src/lit-html.ts#L670-L683
export const removeNodes =
    (container: Node, startNode: Node | null, endNode: Node | null = null):
        void => {
          let node = startNode;
          while (node !== endNode) {
            const n = node!.nextSibling;
            container.removeChild(node!);
            node = n;
          }
        };

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
import { LtiTemplateProcessor } from './lti-template-processor.js';

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

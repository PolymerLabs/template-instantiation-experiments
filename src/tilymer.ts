import '../../template-instantiation/lib/html-template-element.js';
import { TemplateInstance } from
    '../../template-instantiation/lib/template-instance.js';
import { TemplateProcessor } from
    '../../template-instantiation/lib/template-processor.js';
import { TemplatePart, NodeTemplatePart, AttributeTemplatePart } from
    '../../template-instantiation/lib/template-part.js';
import { NodeTemplateRule, AttributeTemplateRule } from
    '../../template-instantiation/lib/template-rule.js';

// NOTE(cdata): dashToCamelCase and camelToDashCase adapted from Polymer
// @see https://github.com/Polymer/polymer/blob/1.x/src/lib/case-map.html
interface CaseMap {
  [index: string]: string;
}

const dashToCamelRe = /-[a-z]/g;
const camelToDashRe = /([A-Z])/g;
const caseMap: CaseMap = {};

export const dashToCamelCase = (dash: string) => caseMap[dash] ||
    (caseMap[dash] = dash.indexOf('-') < 0
        ? dash
        : dash.replace(dashToCamelRe, (m: string) => m[1].toUpperCase()));

export const camelToDashCase = (camel: string) => caseMap[camel] ||
    (caseMap[camel] = camel.replace(camelToDashRe, '-$1').toLowerCase());
// End of direct Polymer adaptations

export interface TilymerPropertyConfig {
  readOnly?: boolean;
  notify?: boolean;
  value?: any;
}

export interface TilymerProperties {
  [index: string]: TilymerPropertyConfig
}

export interface TilymerPrototype extends HTMLElement {
  is: string;
  properties: TilymerProperties;
}

export interface TilymerData {
  [index: string]: any
}

export const capitalize = (name: string) =>
    `${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;

export const normalizePropertyConfig =
    (config: TilymerPropertyConfig): TilymerPropertyConfig => {
      let { value: configValue } = config;
      let value;

      if (typeof configValue !== 'function') {
        value = () => configValue;
      }

      return {
        readOnly: false,
        notify: false,
        ...config,
        value
      };
    };

class TilymerTemplateProcessor extends TemplateProcessor {
  processCallback(parts: TemplatePart[], state?: TilymerData) {

    for (const part of parts) {
      if (part instanceof NodeTemplatePart) {
        const { expression } = part.rule as NodeTemplateRule;
        part.value = state && expression && state[expression];
      } else if (part instanceof AttributeTemplatePart) {
        const { expressions, attributeName } =
            part.rule as AttributeTemplateRule;
        const values = state && expressions &&
            expressions.map(expression => state && state[expression]);

        const { node } = part;
        const property = dashToCamelCase(attributeName);

        if (values == null) {
          (node as any)[property] = values;
        } else if (values.length > 1) {
          (node as any)[property] = values.join('');
        } else {
          (node as any)[property] = values[0];
        }
      }
    }
  }
}


const tilymerTemplateProcessor = new TilymerTemplateProcessor();

export const Tilymer = (prototype: TilymerPrototype) => {
  const { is, properties } = prototype;
  const observedAttributes: string[] = [];

  class TilymerElement extends HTMLElement {
    static defaults: TilymerData = {};
    static finalized: boolean;

    static get template(): HTMLTemplateElement | null {
      return document.querySelector(`#${is}`) || null;
    }

    static get observedAttributes() {
      this.finalize();
      return observedAttributes;
    }

    static finalize() {
      if (this.finalized) {
        return;
      }

      const { defaults } = this;

      for (let property in properties) {
        const attribute = camelToDashCase(property);
        const config = normalizePropertyConfig(properties[property]);
        const valueSetter = function(this: TilymerElement, value: any) {
          const oldValue = this.data[property];
          this.data[property] = value;

          if (config.notify) {
            this.dispatchEvent(new CustomEvent(`${attribute}-changed`,
                { detail: { property: property, value, oldValue } }));
          }

          if (this.templateInstance != null) {
            this.templateInstance.update(this.data);
          }
        };

        Object.defineProperty(this.prototype, property, {
          get(this: TilymerElement) {
            return this.data[property];
          },

          set(this: TilymerElement, value) {
            if (config.readOnly) {
              return;
            }

            valueSetter.call(this, value);
          }
        });

        if (config.readOnly) {
          Object.defineProperty(this.prototype, `_set${capitalize(property)}`, {
            value(value: any) {
              valueSetter.call(this, value);
            }
          });
        }

        observedAttributes.push(attribute);
        defaults[property] = config.value;
      }

      this.finalized = true;
    }

    protected data: TilymerData = {};
    protected templateInstance: TemplateInstance;

    constructor() {
      super();
      const Implementation = this.constructor as typeof TilymerElement;
      const { template, defaults } = Implementation;

      Implementation.finalize();

      if (template != null) {
        this.attachShadow({ mode: 'open' });

        this.templateInstance =
            template.createInstance(tilymerTemplateProcessor);

        this.shadowRoot!.appendChild(this.templateInstance);

        for (const property in defaults) {
          (this as any)[property] = defaults[property]();
        }
      }
    }
  }

  customElements.define(is, TilymerElement);
};

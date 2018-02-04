import { Spec } from '../../@0xcda7a/test-runner/lib/spec.js';
import { Fixturable } from '../../@0xcda7a/test-runner/lib/mixins/fixturable.js';
import '../../chai/chai.js';
import { html, render } from './lti-html.js';
import { TemplateAssembly } from '../../template-instantiation/lib/template-assembly.js';
import { TemplateRule, AttributeTemplateRule } from
    '../../template-instantiation/lib/template-rule.js';

const { expect } = chai;
const spec = new (Fixturable(Spec))();
const { describe, it, fixture } = spec;

describe('lti-html', () => {
  it('returns a TemplateAssembly', () => {
    expect(html``).to.be.instanceof(TemplateAssembly);
  });

  it('shares a definition for identical calls', () => {
    const call = () => html``;
    expect(call().definition).to.be.equal(call().definition);
  });

  it('has state that contains all interpolated values', () => {
    const foo = 'foo', bar = 1;
    const { state } = html`${foo}${bar}`;

    expect(state).to.be.eql([foo, bar]);
  });

  describe('creating text nodes', () => {
    fixture(() => {
      const countNodes = (assembly: TemplateAssembly,
          getNodes: (f: DocumentFragment) => NodeList) =>
              getNodes(assembly.definition.parsedTemplate.content).length;

      return { countNodes };
    });

    it('creates two for a nested part', ({ countNodes }: any) => {
      expect(countNodes(html`<div>${0}</div>`,
          (c: DocumentFragment) => c.childNodes[0].childNodes)).to.be.equal(2);
    });

    it('creates two for a non-nested part', ({ countNodes }: any) => {
      expect(countNodes(html`${0}`,
          (c: DocumentFragment) => c.childNodes)).to.be.equal(2);
    });

    it('creates two for a non-nested part with a leading string',
        ({ countNodes }: any) => {
          expect(countNodes(html`a${0}`,
              (c: DocumentFragment) => c.childNodes)).to.be.equal(2);
        });

    it('creates two for a non-tested part with a trailing string',
        ({ countNodes }: any) => {
          expect(countNodes(html`${0}a`,
              (c: DocumentFragment) => c.childNodes)).to.be.equal(2);
        });

    it('creates three for two non-nested parts',
        ({ countNodes }: any) => {
          expect(countNodes(html`${0}${0}`,
              (c: DocumentFragment) => c.childNodes)).to.be.equal(3);
        });

    it('creates three for two non-nested parts with a leading string',
        ({ countNodes }: any) => {
          expect(countNodes(html`a${0}${0}`,
              (c: DocumentFragment) => c.childNodes)).to.be.equal(3);
        });

    it('creates three for two non-nested parts separated by a string',
        ({ countNodes }: any) => {
          expect(countNodes(html`${0}b${0}`,
              (c: DocumentFragment) => c.childNodes)).to.be.equal(3);
        });

    it('creates three for two non-nested parts with a trailing string',
        ({ countNodes }: any) => {
          expect(countNodes(html`${0}${0}c`,
              (c: DocumentFragment) => c.childNodes)).to.be.equal(3);
        });

    it('creates three for two non-nested parts spearated by strings',
        ({ countNodes }: any) => {
          expect(countNodes(html`a${0}b${0}c`,
              (c: DocumentFragment) => c.childNodes)).to.be.equal(3);
        });
  });

  it('parses rules for multiple parts', () => {
    const result = html`
<div a="${1}">
  <p>${2}</p>
  ${3}
  <span a="${4}">${5}</span>
</div>`;
    const { rules } = result.definition;
    expect(rules.length).to.be.equal(5);
  });


  it('stores the names of attributes', () => {
    const result = html`
<div
  someProp="${1}"
  a-nother="${2}"
  multiParts='${3} ${4}'
  👍=${5}
  (a)=${6}
  [a]=${7}
  a$=${8}>
  <p>${9}</p>
  <div aThing="${10}"></div>
</div>`;
    const { rules } = result.definition;
    const names = rules.map((s: TemplateRule) =>
        (s as AttributeTemplateRule).attributeName);

    expect(names).to.be.eql([
      'someprop',
      'a-nother',
      'multiparts',
      '👍',
      '(a)',
      '[a]',
      'a$',
      undefined,
      'athing'
    ]);
  });

  describe('rule parsing', () => {
    fixture(() => {
      return { container: document.createElement('div') };
    });

    it('can handle an element-less text rule', ({ container }: any) => {
      render(html`test`, container);
      expect(container.innerHTML).to.be.equal('test');
    });

    it('distinguishes between two child nodes of one element',
        ({ container }: any) => {
          render(html`<div>${1} ${2}</div>`, container);
          expect(container.innerHTML).to.be.equal('<div>1 2</div>');
        });

    it('distinguishes between two attributes of one element',
        ({ container }: any) => {
          render(html`<div a="${1}" b="${2}"></div>`, container);
          expect(container.innerHTML).to.be.equal('<div a="1" b="2"></div>');
        });
  });

  it('updates when called multiple times with arrays', () => {
    const container = document.createElement('div');
    const ul = (list: string[]) => {
      const items = list.map((item) => html`<li>${item}</li>`);
      return html`<ul>${items}</ul>`;
    };
    render(ul(['a', 'b', 'c']), container);

    expect(container.innerHTML).to.be.equal(
        '<ul><li>a</li><li>b</li><li>c</li></ul>');

    render(ul(['x', 'y']), container);

    expect(container.innerHTML).to.be.equal('<ul><li>x</li><li>y</li></ul>');
  });

  describe('security qualities', () => {
    fixture(() => {
      return { container: document.createElement('div') };
    });

    it('resists XSS attempt in node values', ({ container }: any) => {
      render(html`<div>${'<script>alert("boo");</script>'}</div>`, container);
      expect(container.innerHTML).to.be.equal(
          '<div>&lt;script&gt;alert("boo");&lt;/script&gt;</div>');
    });

    it('resists XSS attempt in attribute values', ({ container }: any) => {
      render(html
          `<div foo="${'"><script>alert("boo");</script><div foo="'}"></div>`,
          container);
      expect(container.innerHTML).to.be.equal(
          '<div foo="&quot;><script>alert(&quot;boo&quot;);</script><div foo=&quot;"></div>');
    });
  });


  describe('when updating', () => {
    fixture(() => {
      return {
        container: document.createElement('div'),
        assemble: (content: any) => html`<div>${content}</div>`,
        content: 'aaa',
        alternativeContent: 'bbb'
      };
    });

    it('dirty checks simple values',
        ({ container, assemble, content, alternativeContent }: any) => {

      render(assemble(content), container);
      expect(container.innerHTML).to.be.equal(`<div>${content}</div>`);

      const text = container.firstChild!.childNodes[1] as Text;
      expect(text.textContent).to.be.equal(content);

      // Set textContent manually. Since lit-html doesn't dirty checks against
      // actual DOM, but again previous part values, this modification should
      // persist through the next render with the same value.
      text.textContent = alternativeContent;

      // Re-render with the same content, should be a no-op
      render(assemble(content), container);

      expect(text.textContent).to.be.equal(alternativeContent);
      expect(container.innerHTML).to.be.equal(
          `<div>${alternativeContent}</div>`);

      const otherText = container.firstChild!.childNodes[1] as Text;

      // The next node should be the same too
      expect(text).to.be.equal(otherText);
    });

    it('renders to and updates a container',
        ({ container, assemble, content, alternativeContent }: any) => {
      render(assemble(content), container);
      expect(container.innerHTML).to.be.equal(`<div>${content}</div>`);

      const div = container.firstChild as HTMLDivElement;
      expect(div.tagName).to.be.equal('DIV');

      render(assemble(alternativeContent), container);
      expect(container.innerHTML).to.be.equal(`<div>${alternativeContent}</div>`);

      const otherDiv = container.firstChild as HTMLDivElement;
      // check that only the part changed
      expect(div).to.be.equal(otherDiv);
    });

    describe('sibling parts', () => {
      fixture((context: any) => {
        return {
          ...context,
          assemble: (foo: any, bar: any) => html`<div>${foo}${bar}</div>`
        }
      });

      it('renders to and updates both parts',
          ({ container, assemble, content, alternativeContent }: any) => {
        render(assemble(content, alternativeContent), container);
        expect(container.innerHTML).to.be.equal(
            `<div>${content}${alternativeContent}</div>`);

        render(assemble(alternativeContent, content), container);
        expect(container.innerHTML).to.be.equal(
            `<div>${alternativeContent}${content}</div>`);
      });
    });

    describe('nested parts', () => {
      fixture((context: any) => {
        return {
          ...context,
          assemble: (foo: any, bar: any, primary: boolean) => {
            const partial = primary
                ? html`<h1>${foo}</h1>`
                : html`<h2>${bar}</h2>`

            return html`${partial}${'suffix'}`;
          }
        };
      });

      it('updates nested templates',
          ({ container, assemble, content, alternativeContent }: any) => {
        render(assemble(content, alternativeContent, true), container);
        expect(container.innerHTML).to.be.equal(`<h1>${content}</h1>suffix`);

        render(assemble(alternativeContent, content, true), container);
        expect(container.innerHTML).to.be.equal(
            `<h1>${alternativeContent}</h1>suffix`);

        render(assemble(content, alternativeContent, false), container);
        expect(container.innerHTML).to.be.equal(
            `<h2>${alternativeContent}</h2>suffix`);
      });
    });

    describe('array values', () => {
      it('changes with a new array of same length', ({ container }: any) => {
        const assemble = (items: number[]) => html`<div>${items}</div>`;

        render(assemble([1, 2, 3]), container);
        expect(container.innerHTML).to.be.equal('<div>123</div>');

        render(assemble([3, 2, 1]), container);
        expect(container.innerHTML).to.be.equal('<div>321</div>');
      });

      it('updates when arrays shrink and grow', ({ container }: any) => {
        const assemble = (items: number[]) => html`<div>${items}</div>`;

        render(assemble([1, 2, 3]), container);
        expect(container.innerHTML).to.be.equal('<div>123</div>');

        render(assemble([4]), container);
        expect(container.innerHTML).to.be.equal('<div>4</div>');

        render(assemble([5, 6, 7]), container);
        expect(container.innerHTML).to.be.equal('<div>567</div>');
      });

      it('updates a changing array of nodes', ({ container }: any) => {
        const assemble = (children: any) => html`<div>${children}</div>`;

        render(assemble([
          document.createElement('p'),
          document.createElement('a'),
          document.createElement('span')
        ]), container);
        expect(container.innerHTML).to.be.equal('<div><p></p><a></a><span></span></div>');

        render(assemble(null), container);
        expect(container.innerHTML).to.be.equal('<div></div>');

        render(assemble(document.createTextNode('foo')), container);
        expect(container.innerHTML).to.be.equal('<div>foo</div>');
      });
    });
  });
});

export const ltiHtmlSpec: Spec = spec;

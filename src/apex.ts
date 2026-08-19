import {
  ApexErrorListener,
  ApexLexer,
  ApexParserFactory,
  ApexParserRuleContext,
  ApexParseTree,
  ApexTokenStream,
  BlockContext,
  ConstructorDeclarationContext,
  GetterContext,
  MethodDeclarationContext,
  PropertyDeclarationContext,
  SetterContext,
} from '@apexdevtools/apex-parser';

export type ApexStubReview = {
  line?: number;
  reason: string;
};

export type ApexStubResult = {
  content: string;
  changed: boolean;
  reviews: ApexStubReview[];
};

type SyntaxError = {
  line: number;
  column: number;
  message: string;
};

type ExecutableBlock = {
  block: BlockContext;
  label: string;
  line: number;
  returnsValue: boolean;
};

type Replacement = {
  start: number;
  end: number;
  content: string;
};

class CollectingErrorListener extends ApexErrorListener {
  public readonly errors: SyntaxError[] = [];

  public apexSyntaxError(line: number, column: number, message: string): void {
    this.errors.push({ line, column, message });
  }
}

function propertyName(context: GetterContext | SetterContext): string {
  let parent = context.parentCtx;
  while (parent) {
    if (parent instanceof PropertyDeclarationContext)
      return parent.id().getText();
    parent = parent.parentCtx;
  }
  return 'property accessor';
}

function executableBlocks(tree: ApexParseTree): ExecutableBlock[] {
  const result: ExecutableBlock[] = [];
  const visit = (node: ApexParseTree): void => {
    if (node instanceof MethodDeclarationContext && node.block()) {
      result.push({
        block: node.block(),
        label: `method ${node.id().getText()}`,
        line: node.start.line,
        returnsValue: !node.VOID(),
      });
    } else if (node instanceof ConstructorDeclarationContext) {
      result.push({
        block: node.block(),
        label: `constructor ${node.qualifiedName().getText()}`,
        line: node.start.line,
        returnsValue: false,
      });
    } else if (node instanceof GetterContext && node.block()) {
      result.push({
        block: node.block(),
        label: `getter ${propertyName(node)}`,
        line: node.start.line,
        returnsValue: true,
      });
    } else if (node instanceof SetterContext && node.block()) {
      result.push({
        block: node.block(),
        label: `setter ${propertyName(node)}`,
        line: node.start.line,
        returnsValue: false,
      });
    }
    for (const child of (node as ApexParserRuleContext).children ?? [])
      visit(child);
  };
  visit(tree);
  return result;
}

function parse(content: string): {
  blocks: ExecutableBlock[];
  errors: SyntaxError[];
  tokens: ApexTokenStream;
} {
  const listener = new CollectingErrorListener();
  const { parser } = ApexParserFactory.createLexerAndParser(content, listener);
  const tree = parser.compilationUnit();
  const tokens = parser.getTokenStream() as ApexTokenStream;
  tokens.fill();
  return {
    blocks: executableBlocks(tree),
    errors: listener.errors,
    tokens,
  };
}

function syntaxReviews(errors: SyntaxError[], stage: string): ApexStubReview[] {
  return errors.map((error) => ({
    line: error.line,
    reason: `${stage} Apex syntax error at column ${error.column + 1}: ${
      error.message
    }`,
  }));
}

function indentationAt(content: string, position: number): string {
  const lineStart = content.lastIndexOf('\n', position - 1) + 1;
  return content.slice(lineStart, position).match(/^\s*/)?.[0] ?? '';
}

export function stubApexMethods(
  content: string,
  fieldNames: string[]
): ApexStubResult {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(content);
  } catch (error) {
    return {
      content,
      changed: false,
      reviews: [
        {
          reason: `Apex parser failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
  if (parsed.errors.length)
    return {
      content,
      changed: false,
      reviews: syntaxReviews(parsed.errors, 'Original'),
    };

  const targets = new Set(
    fieldNames.flatMap((fieldName) => {
      const identifier = fieldName.split('.').at(-1)!.toLowerCase();
      return identifier.endsWith('__c')
        ? [identifier, `${identifier.slice(0, -3)}__r`]
        : [identifier];
    })
  );
  const references = parsed.tokens.tokens.filter(
    (token) =>
      token.type === ApexLexer.Identifier &&
      targets.has(token.text.toLowerCase())
  );
  const referencesByBlock = new Map<ExecutableBlock, typeof references>();
  const unsupported: typeof references = [];

  for (const reference of references) {
    const containing = parsed.blocks
      .filter((item) => {
        const open = item.block.LBRACE().symbol.start;
        const close = item.block.RBRACE().symbol.start;
        return reference.start > open && reference.stop < close;
      })
      .sort(
        (a, b) =>
          a.block.RBRACE().symbol.start -
          a.block.LBRACE().symbol.start -
          (b.block.RBRACE().symbol.start - b.block.LBRACE().symbol.start)
      )[0];
    if (!containing) {
      unsupported.push(reference);
      continue;
    }
    const items = referencesByBlock.get(containing) ?? [];
    items.push(reference);
    referencesByBlock.set(containing, items);
  }

  const reviews: ApexStubReview[] = unsupported.map((reference) => ({
    line: reference.line,
    reason: `Field reference outside an editable Apex method: ${reference.text}`,
  }));
  const replacements: Replacement[] = [];
  for (const [item, itemReferences] of referencesByBlock) {
    const open = item.block.LBRACE().symbol.start;
    const close = item.block.RBRACE().symbol.start;
    const indent = indentationAt(content, open);
    const bodyIndent = `${indent}    `;
    const fields = [...new Set(itemReferences.map((token) => token.text))].join(
      ', '
    );
    replacements.push({
      start: open + 1,
      end: close,
      content: `\n${bodyIndent}// FIELD-TYPE-CHANGE: disabled ${
        item.label
      } (${fields})\n${
        item.returnsValue ? `${bodyIndent}return null;\n` : ''
      }${indent}`,
    });
    reviews.push({
      line: item.line,
      reason: `Apex ${item.label} was replaced with a temporary stub`,
    });
  }

  if (!references.length) {
    reviews.push({
      reason:
        'The dependency API reported an Apex reference, but no matching field identifier was found',
    });
  }
  let transformed = content;
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    transformed = `${transformed.slice(0, replacement.start)}${
      replacement.content
    }${transformed.slice(replacement.end)}`;

  if (transformed === content) return { content, changed: false, reviews };
  try {
    const verification = parse(transformed);
    if (verification.errors.length)
      return {
        content,
        changed: false,
        reviews: syntaxReviews(verification.errors, 'Generated'),
      };
  } catch (error) {
    return {
      content,
      changed: false,
      reviews: [
        {
          reason: `Generated Apex could not be verified: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
  return { content: transformed, changed: true, reviews };
}

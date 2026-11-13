import type { ReactNode } from "react";

interface JsonCodeProps {
  code: string;
  showLineNumbers?: boolean;
  className?: string;
}

const TOKEN_PATTERN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:)|("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function highlightLine(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    if (match.index > cursor) {
      nodes.push(line.slice(cursor, match.index));
    }

    if (match[1]) {
      nodes.push(
        <span className="token-key" key={`key-${index}`}>
          {match[1]}
        </span>,
      );
    } else if (match[2]) {
      nodes.push(
        <span className="token-string" key={`string-${index}`}>
          {match[2]}
        </span>,
      );
    } else {
      nodes.push(
        <span className="token-constant" key={`constant-${index}`}>
          {match[0]}
        </span>,
      );
    }

    cursor = match.index + match[0].length;
    index += 1;
  }

  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

export function JsonCode({
  code,
  showLineNumbers = false,
  className = "",
}: JsonCodeProps) {
  const lines = code.split("\n");

  return (
    <pre className={`json-code ${className}`.trim()}>
      <code>
        {lines.map((line, index) => (
          <span className="code-line" key={index}>
            {showLineNumbers ? (
              <span className="code-line-number" aria-hidden="true">
                {index + 1}
              </span>
            ) : null}
            <span className="code-line-content">
              {line ? highlightLine(line) : " "}
            </span>
          </span>
        ))}
      </code>
    </pre>
  );
}

// Keep hyphenated words (front-end, TanStack-based) on one line. A line break at
// the hyphen makes PDF text extraction join the halves, which hurts keyword matching.
// Runs here, not in the build, so the browser preview breaks lines like the PDF.
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
const hyphenated = [];
while (walker.nextNode()) if (/\S-\S/.test(walker.currentNode.nodeValue)) hyphenated.push(walker.currentNode);
for (const node of hyphenated) {
  const parts = node.nodeValue.split(/(\S+-\S+)/);
  node.replaceWith(...parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const span = document.createElement("span");
    span.style.whiteSpace = "nowrap";
    span.textContent = part;
    return span;
  }));
}

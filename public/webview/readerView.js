(() => {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('reader-root');
  const screen = document.getElementById('reader-screen');
  const measure = document.createElement('span');
  measure.className = 'reader-measure';
  measure.textContent = '0'.repeat(100);
  root.appendChild(measure);

  const protocol = window.readOnBushProtocol;
  const styleNames = new Set(protocol.styles);
  const inputKeys = new Set(protocol.inputKeys);
  let resizeFrame;
  const lineElements = [];
  const segmentElements = [];

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'frame') {
      renderFrame(message);
      return;
    }

    if (message.type === 'clear') {
      screen.replaceChildren();
      return;
    }

    if (message.type === 'focus') {
      root.focus();
    }
  });

  root.addEventListener('keydown', (event) => {
    const data = getInputData(event);
    if (!data) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    vscode.postMessage({ type: 'input', protocol: protocol.version, data });
  });

  root.addEventListener('click', () => root.focus());
  window.addEventListener('resize', scheduleResize);
  new ResizeObserver(scheduleResize).observe(root);

  vscode.postMessage({ type: 'ready', protocol: protocol.version });
  scheduleResize();
  root.focus();

  function renderFrame(frame) {
    if (!Array.isArray(frame.lines)) {
      return;
    }

    frame.lines.forEach((line, lineIndex) => {
      const lineElement = lineElements[lineIndex] ?? createLineElement(lineIndex);
      const spans = segmentElements[lineIndex];
      lineElement.className = 'reader-line';

      if (!Array.isArray(line)) {
        lineElement.replaceChildren();
        lineElement.textContent = ' ';
      } else {
        if (
          lineElement.childNodes.length === 1 &&
          lineElement.firstChild?.nodeType === Node.TEXT_NODE
        ) {
          lineElement.replaceChildren();
        }

        let segmentIndex = 0;
        for (const segment of line) {
          if (!segment || typeof segment.text !== 'string') {
            continue;
          }

          const segmentElement = spans[segmentIndex] ?? createSegmentElement(spans);
          const style = styleNames.has(segment.style) ? segment.style : 'plain';
          segmentElement.className = `ansi-${style}`;
          segmentElement.textContent = segment.text;
          lineElement.appendChild(segmentElement);
          segmentIndex += 1;
        }

        while (spans.length > segmentIndex) {
          spans.pop()?.remove();
        }
        if (segmentIndex === 0) {
          lineElement.replaceChildren();
          lineElement.textContent = ' ';
        }
      }

      if (lineElement.parentNode !== screen) {
        screen.appendChild(lineElement);
      }
    });

    while (screen.childElementCount > frame.lines.length) {
      screen.lastElementChild?.remove();
    }
  }

  function createLineElement(lineIndex) {
    const lineElement = document.createElement('div');
    lineElement.className = 'reader-line';
    lineElements[lineIndex] = lineElement;
    segmentElements[lineIndex] = [];
    return lineElement;
  }

  function createSegmentElement(spans) {
    const segmentElement = document.createElement('span');
    spans.push(segmentElement);
    return segmentElement;
  }

  function scheduleResize() {
    if (resizeFrame !== undefined) {
      return;
    }

    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = undefined;
      sendResize();
    });
  }

  function sendResize() {
    const width = measure.getBoundingClientRect().width / 100;
    const lineHeight = Number.parseFloat(getComputedStyle(measure).lineHeight) || 18;
    const columns = Math.floor(root.clientWidth / Math.max(width, 1));
    const rows = Math.floor(root.clientHeight / lineHeight);

    if (columns <= 0 || rows <= 0) {
      return;
    }

    vscode.postMessage({
      type: 'resize',
      protocol: protocol.version,
      columns,
      rows
    });
  }

  function getInputData(event) {
    if (event.key === 'ArrowRight') {
      return '\x1b[C';
    }
    if (event.key === 'ArrowLeft') {
      return '\x1b[D';
    }
    if (event.key.length === 1 && inputKeys.has(event.key.toLowerCase())) {
      return event.key.toLowerCase();
    }
    return undefined;
  }
})();

(() => {
  const vscode = acquireVsCodeApi();
  let styles = ['plain'];
  const sectionDefinitions = [
    { key: 'header', title: 'Header', description: '阅读正文前显示的日志行' },
    { key: 'trailing', title: 'Trailing', description: '阅读正文后显示的日志行' },
    { key: 'debugContent', title: 'Debug Content', description: '快速隐藏或按 d 时显示的伪装正文' }
  ];
  // 表单区段顺序与右侧预览一致：Header → Trailing → Done → Debug Content
  const formOrder = ['header', 'trailing', 'done', 'debugContent'];
  const sectionsRoot = document.getElementById('sections');
  const terminalNameInput = document.getElementById('terminal-name');
  const contentPrefixInput = document.getElementById('content-prefix');
  const saveButton = document.getElementById('save-enable');
  const diagnosticsElement = document.getElementById('diagnostics');
  const previewElement = document.getElementById('terminal-preview');
  const templateJsonElement = document.getElementById('template-json');
  const settingsJsonElement = document.getElementById('settings-json');
  const notificationElement = document.getElementById('notification');

  let draft = normalizeDraft(vscode.getState()?.draft);
  let debounceTimer;
  let notificationTimer;

  terminalNameInput.addEventListener('input', handleBaseFieldChanged);
  contentPrefixInput.addEventListener('input', handleBaseFieldChanged);
  saveButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'saveAndEnable', draft: serializeDraft(draft) });
  });
  document.getElementById('copy-template').addEventListener('click', () => {
    vscode.postMessage({ type: 'copyTemplateJson', draft: serializeDraft(draft) });
  });
  document.getElementById('copy-settings').addEventListener('click', () => {
    vscode.postMessage({ type: 'copySettingsJson', draft: serializeDraft(draft) });
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message.type !== 'string') {
      return;
    }
    if (message.type === 'stateUpdated') {
      if (Array.isArray(message.styleOptions) && message.styleOptions.length > 0) {
        styles = message.styleOptions.filter((style) => typeof style === 'string');
      }
      if (message.replaceDraft) {
        draft = normalizeDraft(message.draft);
        renderForm();
        persistDraft();
      }
      renderPreview(message.previewLines, message.previewSections);
      renderDiagnostics(message.diagnostics);
      templateJsonElement.value = message.templateJson || '';
      settingsJsonElement.value = message.settingsJson || '';
      saveButton.disabled = !message.canSave;
      return;
    }
    if (message.type === 'notification') {
      showNotification(message.message);
    }
  });

  function renderForm() {
    terminalNameInput.value = draft.terminalName;
    contentPrefixInput.value = draft.contentPrefix;
    sectionsRoot.replaceChildren();

    for (const sectionKey of formOrder) {
      if (sectionKey === 'done') {
        sectionsRoot.appendChild(createDoneSection());
      } else {
        const definition = sectionDefinitions.find((item) => item.key === sectionKey);
        if (definition) {
          sectionsRoot.appendChild(createArraySection(definition));
        }
      }
    }
  }

  function createArraySection(definition) {
    const section = document.createElement('section');
    section.className = 'template-section';
    section.dataset.section = definition.key;

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    const titleBlock = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = definition.title;
    const description = document.createElement('p');
    description.textContent = definition.description;
    titleBlock.append(title, description);

    const addButton = document.createElement('button');
    addButton.className = 'secondary compact';
    addButton.textContent = '新增行';
    addButton.addEventListener('click', () => {
      draft[definition.key].push({ text: '', style: 'plain' });
      renderForm();
      emitDraftChanged();
      focusLastLine(definition.key);
    });
    heading.append(titleBlock, addButton);
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'line-list';
    list.dataset.section = definition.key;
    draft[definition.key].forEach((line, index) => {
      list.appendChild(createLineRow(definition.key, line, index, true));
    });
    if (draft[definition.key].length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-hint';
      empty.textContent = '暂无内容，点击“新增行”添加。';
      list.appendChild(empty);
    }
    section.appendChild(list);
    return section;
  }

  function createDoneSection() {
    const section = document.createElement('section');
    section.className = 'template-section';
    section.dataset.section = 'done';
    const heading = document.createElement('div');
    heading.className = 'section-heading';
    const titleBlock = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Done';
    const description = document.createElement('p');
    description.textContent = '完成/进度行，可使用 {{progress}}。';
    titleBlock.append(title, description);
    heading.appendChild(titleBlock);
    section.append(heading, createLineRow('done', draft.done, 0, false));
    return section;
  }

  function createLineRow(sectionKey, line, index, movable) {
    const row = document.createElement('div');
    row.className = 'line-row';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.maxLength = 1000;
    textInput.value = line.text;
    textInput.placeholder = '输入日志内容，留空表示空行';
    textInput.addEventListener('input', () => {
      updateLine(sectionKey, index, { ...line, text: textInput.value });
    });

    const styleSelect = document.createElement('select');
    styleSelect.setAttribute('aria-label', '行样式');
    for (const style of styles) {
      const option = document.createElement('option');
      option.value = style;
      option.textContent = style;
      option.selected = line.style === style;
      styleSelect.appendChild(option);
    }
    styleSelect.addEventListener('change', () => {
      updateLine(sectionKey, index, { ...line, style: styleSelect.value });
    });

    row.append(textInput, styleSelect);
    if (movable) {
      const actions = document.createElement('div');
      actions.className = 'line-actions';
      actions.append(
        createIconButton('↑', '上移', () => moveLine(sectionKey, index, -1), index === 0),
        createIconButton(
          '↓',
          '下移',
          () => moveLine(sectionKey, index, 1),
          index === draft[sectionKey].length - 1
        ),
        createIconButton('×', '删除', () => removeLine(sectionKey, index), false, 'danger')
      );
      row.appendChild(actions);
    }
    return row;
  }

  function createIconButton(text, label, onClick, disabled, className = '') {
    const button = document.createElement('button');
    button.className = `icon-button ${className}`.trim();
    button.type = 'button';
    button.textContent = text;
    button.title = label;
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  }

  function updateLine(sectionKey, index, value) {
    if (sectionKey === 'done') {
      draft.done = value;
    } else {
      draft[sectionKey][index] = value;
    }
    emitDraftChanged();
  }

  function moveLine(sectionKey, index, offset) {
    const target = index + offset;
    if (target < 0 || target >= draft[sectionKey].length) {
      return;
    }
    const lines = draft[sectionKey];
    [lines[index], lines[target]] = [lines[target], lines[index]];
    renderForm();
    emitDraftChanged();
  }

  function removeLine(sectionKey, index) {
    draft[sectionKey].splice(index, 1);
    renderForm();
    emitDraftChanged();
  }

  function handleBaseFieldChanged() {
    draft.terminalName = terminalNameInput.value;
    draft.contentPrefix = contentPrefixInput.value;
    emitDraftChanged();
  }

  function emitDraftChanged() {
    persistDraft();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      vscode.postMessage({ type: 'draftChanged', draft: serializeDraft(draft) });
    }, 120);
  }

  function persistDraft() {
    vscode.setState({ draft });
  }

  function renderPreview(lines, sections) {
    previewElement.replaceChildren();
    const safeLines = Array.isArray(lines) ? lines : [];
    const safeSections = Array.isArray(sections) ? sections : [];

    const lineSectionKey = [];
    const sectionStartAt = new Map();
    for (const section of safeSections) {
      const start = Number(section.start);
      const end = Number(section.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }
      for (let i = start; i < end && i < safeLines.length; i++) {
        lineSectionKey[i] = section.key;
      }
      if (start < safeLines.length) {
        sectionStartAt.set(start, section);
      }
    }

    for (let index = 0; index < safeLines.length; index++) {
      const row = document.createElement('div');
      const sectionKey = lineSectionKey[index] || 'none';
      row.className = `terminal-row section-${sectionKey}`;

      const gutter = document.createElement('div');
      gutter.className = 'preview-gutter';
      const section = sectionStartAt.get(index);
      if (section) {
        const tag = document.createElement('span');
        tag.className = `section-tag section-tag-${section.key}`;
        tag.textContent = section.label;
        gutter.appendChild(tag);
      }

      const lineElement = document.createElement('div');
      lineElement.className = 'terminal-line';
      for (const segment of Array.isArray(safeLines[index]) ? safeLines[index] : []) {
        const span = document.createElement('span');
        span.className = `ansi-${styles.includes(segment.style) ? segment.style : 'plain'}`;
        span.textContent = typeof segment.text === 'string' ? segment.text : '';
        lineElement.appendChild(span);
      }
      row.append(gutter, lineElement);
      previewElement.appendChild(row);
    }
  }

  function renderDiagnostics(diagnostics) {
    diagnosticsElement.replaceChildren();
    const items = Array.isArray(diagnostics) ? diagnostics : [];
    diagnosticsElement.hidden = items.length === 0;
    if (items.length === 0) {
      return;
    }
    const list = document.createElement('ul');
    for (const diagnostic of items) {
      const item = document.createElement('li');
      item.textContent = `${diagnostic.path || '$'}：${diagnostic.message || '无效配置'}`;
      list.appendChild(item);
    }
    diagnosticsElement.appendChild(list);
  }

  function showNotification(message) {
    notificationElement.textContent = typeof message === 'string' ? message : '';
    notificationElement.hidden = false;
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
      notificationElement.hidden = true;
    }, 2200);
  }

  function normalizeDraft(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      version: 1,
      terminalName: typeof source.terminalName === 'string' ? source.terminalName : 'dev server',
      contentPrefix: typeof source.contentPrefix === 'string' ? source.contentPrefix : 'INFO  ',
      header: normalizeLines(source.header),
      trailing: normalizeLines(source.trailing),
      done: normalizeLine(source.done),
      debugContent: normalizeLines(source.debugContent)
    };
  }

  function normalizeLines(value) {
    return Array.isArray(value) ? value.map(normalizeLine) : [];
  }

  function normalizeLine(value) {
    if (typeof value === 'string') {
      return { text: value, style: 'plain' };
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        text: typeof value.text === 'string' ? value.text : '',
        style: styles.includes(value.style) ? value.style : 'plain'
      };
    }
    return { text: '', style: 'plain' };
  }

  function serializeDraft(value) {
    return {
      version: 1,
      terminalName: value.terminalName,
      contentPrefix: value.contentPrefix,
      header: value.header.map(serializeLine),
      trailing: value.trailing.map(serializeLine),
      done: serializeLine(value.done),
      debugContent: value.debugContent.map(serializeLine)
    };
  }

  function serializeLine(line) {
    return line.style === 'plain' ? line.text : { text: line.text, style: line.style };
  }

  function focusLastLine(sectionKey) {
    requestAnimationFrame(() => {
      const section = sectionsRoot.querySelector(`.template-section[data-section="${sectionKey}"]`);
      const inputs = section?.querySelectorAll('.line-row input');
      inputs?.[inputs.length - 1]?.focus();
    });
  }

  vscode.postMessage({ type: 'ready' });
})();

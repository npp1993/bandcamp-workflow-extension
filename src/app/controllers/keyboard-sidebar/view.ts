import {KeyboardShortcut, ToggleSetting} from './content';

/**
 * Sidebar DOM builders (toggle buttons, hotkey rows, titles), extracted from
 * KeyboardSidebarController. Pure: take a definition, return an element.
 */
export class SidebarView {
  static createToggleButton(setting: ToggleSetting): HTMLElement {
    const button = document.createElement('button');
    button.className = `bcks-setting-${setting.id}`;
    button.style.cssText = `
      padding: 6px 10px;
      cursor: pointer;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 11px;
      font-weight: normal;
      transition: all 0.2s;
      text-align: left;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
    `;

    const keySpan = document.createElement('span');
    keySpan.textContent = setting.hotkey || '';
    keySpan.style.cssText = `
      font-weight: bold;
      color: #495057;
      min-width: 20px;
      flex-shrink: 0;
    `;

    const descSpan = document.createElement('span');
    descSpan.textContent = setting.label;
    descSpan.style.cssText = `
      flex: 1;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-left: 15px;
    `;

    button.appendChild(keySpan);
    button.appendChild(descSpan);

    const updateButton = () => {
      const isEnabled = setting.getter();
      if (isEnabled) {
        button.style.backgroundColor = '#e3f2fd';
        button.style.borderColor = '#2196f3';
        button.style.color = '#1976d2';
        descSpan.style.fontWeight = 'bold';
      } else {
        button.style.backgroundColor = '#f8f9fa';
        button.style.borderColor = '#dee2e6';
        button.style.color = '#333';
        descSpan.style.fontWeight = 'normal';
      }
    };

    button.addEventListener('click', () => {
      setting.setter(!setting.getter());
      updateButton();
    });

    button.addEventListener('mouseenter', () => {
      if (!setting.getter()) {
        button.style.backgroundColor = '#e9ecef';
      }
    });

    button.addEventListener('mouseleave', () => {
      updateButton();
    });

    updateButton();

    return button;
  }

  static createHotkeyButton(shortcut: KeyboardShortcut): HTMLElement {
    const button = document.createElement('button');
    button.className = `bcks-hotkey-${shortcut.key.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    button.style.cssText = `
      padding: 6px 10px;
      cursor: pointer;
      background-color: #f8f9fa;
      color: #333;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 11px;
      font-weight: normal;
      transition: background-color 0.2s;
      text-align: left;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    `;

    const keySpan = document.createElement('span');
    keySpan.textContent = shortcut.key;
    keySpan.style.cssText = `
      font-weight: bold;
      color: #495057;
      flex-shrink: 0;
      white-space: nowrap;
    `;

    const descSpan = document.createElement('span');
    descSpan.textContent = shortcut.description;
    // Wrap long descriptions instead of truncating them, so no shortcut label is
    // ever cut off regardless of the sidebar width.
    descSpan.style.cssText = `
      flex: 1;
      text-align: right;
      overflow-wrap: anywhere;
    `;

    button.appendChild(keySpan);
    button.appendChild(descSpan);

    button.addEventListener('click', () => {
      shortcut.action();
    });

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#e9ecef';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#f8f9fa';
    });

    return button;
  }

  static createTitle(text: string): HTMLElement {
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
      display: flex;
      align-items: center;
      font-weight: bold;
      font-size: 13px;
      color: #495057;
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 5px;
      margin-bottom: 5px;
      user-select: none;
    `;

    // Create title text
    const titleText = document.createElement('span');
    titleText.textContent = text;

    titleContainer.appendChild(titleText);

    return titleContainer;
  }
}

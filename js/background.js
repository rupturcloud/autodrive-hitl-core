/**
 * Autodrive HITL Core - Background Service Worker v2.4
 * Service worker MV3 - gerencia estado global e comunicacao
 */

'use strict';

// === Estado global ===
let engineState = {
  running: false,
  activeTabs: new Set()
};

// === Instalacao ===
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Autodrive HITL Core instalado. Razao:', details.reason);
  
  // Configuracoes padrao
  chrome.storage.local.set({
    config: {
      autodriveThreshold: 85,
      hitlThreshold: 65,
      stakeBase: 5.00,
      stopWin: 0,
      stopLoss: 0,
      galeMax: 4
    }
  });
});

// === Mensagens do popup e content scripts ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;

  switch (type) {
    case 'GET_STATE':
      sendResponse({ state: engineState });
      break;

    case 'START_ENGINE':
      engineState.running = true;
      // Notificar content scripts
      notifyContentScripts({ type: 'START_ENGINE', config: data });
      sendResponse({ ok: true });
      break;

    case 'STOP_ENGINE':
      engineState.running = false;
      notifyContentScripts({ type: 'STOP_ENGINE' });
      sendResponse({ ok: true });
      break;

    case 'ENGINE_STATUS':
      engineState = { ...engineState, ...data };
      sendResponse({ ok: true });
      break;

    case 'LOG':
      console.log('[Background][ContentScript]', data);
      sendResponse({ ok: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type: ' + type });
  }

  return true; // Keep channel open for async
});

// === Notificar content scripts em tabs ativas ===
async function notifyContentScripts(message) {
  const tabs = await chrome.tabs.query({ active: true });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (e) {
      // Tab pode nao ter o content script
    }
  }
}

// === Atalhos de teclado ===
chrome.commands && chrome.commands.onCommand && chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-engine') {
    if (engineState.running) {
      notifyContentScripts({ type: 'STOP_ENGINE' });
      engineState.running = false;
    } else {
      notifyContentScripts({ type: 'START_ENGINE' });
      engineState.running = true;
    }
  }
});

console.log('[Background] Service Worker v2.4 inicializado');

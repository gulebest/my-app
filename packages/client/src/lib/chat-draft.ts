const CHAT_DRAFT_KEY = 'assistly:chat-draft';

export function readChatDraft() {
   return window.localStorage.getItem(CHAT_DRAFT_KEY) || '';
}

export function writeChatDraft(value: string) {
   window.localStorage.setItem(CHAT_DRAFT_KEY, value);
}

export function clearChatDraft() {
   window.localStorage.removeItem(CHAT_DRAFT_KEY);
}

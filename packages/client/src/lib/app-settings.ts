export type ThemeMode = 'dark' | 'light' | 'system';
export type ChatFontSize = 'small' | 'medium' | 'large';

export interface AppSettings {
   themeMode: ThemeMode;
   chatFontSize: ChatFontSize;
   bubbleWidth: number;
   startNewChatOnOpen: boolean;
   enterToSend: boolean;
   showTimestamps: boolean;
   inAppNotifications: boolean;
   soundOnResponse: boolean;
   muteAllNotifications: boolean;
}

export const defaultAppSettings: AppSettings = {
   themeMode: 'dark',
   chatFontSize: 'medium',
   bubbleWidth: 78,
   startNewChatOnOpen: true,
   enterToSend: true,
   showTimestamps: false,
   inAppNotifications: true,
   soundOnResponse: false,
   muteAllNotifications: false,
};

function storageKey(userId: string | null) {
   return `assistly-settings:${userId || 'guest'}`;
}

function clampBubbleWidth(value: unknown) {
   const parsed = Number(value);
   if (!Number.isFinite(parsed)) {
      return defaultAppSettings.bubbleWidth;
   }
   return Math.min(90, Math.max(60, Math.round(parsed)));
}

function normalizeSettings(input: Partial<AppSettings>): AppSettings {
   return {
      themeMode:
         input.themeMode === 'light' ||
         input.themeMode === 'dark' ||
         input.themeMode === 'system'
            ? input.themeMode
            : defaultAppSettings.themeMode,
      chatFontSize:
         input.chatFontSize === 'small' ||
         input.chatFontSize === 'medium' ||
         input.chatFontSize === 'large'
            ? input.chatFontSize
            : defaultAppSettings.chatFontSize,
      bubbleWidth: clampBubbleWidth(input.bubbleWidth),
      startNewChatOnOpen:
         typeof input.startNewChatOnOpen === 'boolean'
            ? input.startNewChatOnOpen
            : defaultAppSettings.startNewChatOnOpen,
      enterToSend:
         typeof input.enterToSend === 'boolean'
            ? input.enterToSend
            : defaultAppSettings.enterToSend,
      showTimestamps:
         typeof input.showTimestamps === 'boolean'
            ? input.showTimestamps
            : defaultAppSettings.showTimestamps,
      inAppNotifications:
         typeof input.inAppNotifications === 'boolean'
            ? input.inAppNotifications
            : defaultAppSettings.inAppNotifications,
      soundOnResponse:
         typeof input.soundOnResponse === 'boolean'
            ? input.soundOnResponse
            : defaultAppSettings.soundOnResponse,
      muteAllNotifications:
         typeof input.muteAllNotifications === 'boolean'
            ? input.muteAllNotifications
            : defaultAppSettings.muteAllNotifications,
   };
}

export function loadAppSettings(userId: string | null): AppSettings {
   try {
      const raw = window.localStorage.getItem(storageKey(userId));
      if (!raw) {
         return defaultAppSettings;
      }
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return normalizeSettings(parsed);
   } catch {
      return defaultAppSettings;
   }
}

export function saveAppSettings(userId: string | null, settings: AppSettings) {
   window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
}

export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
   if (mode === 'light' || mode === 'dark') {
      return mode;
   }

   if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
   ) {
      return 'light';
   }
   return 'dark';
}

export function clearGuestChatData() {
   window.localStorage.removeItem('assistly-guest-question-count');
}

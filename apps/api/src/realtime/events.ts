// Values mirror @padel/shared; the type annotation fails the build if they drift.
// (@padel/shared is type-only here: the API runtime cannot import its TS source.)
export const SOCKET_SUBSCRIBE_SESSION: typeof import('@padel/shared').SOCKET_SUBSCRIBE_SESSION =
  'session:subscribe';
export const SOCKET_CLIP_UPDATED: typeof import('@padel/shared').SOCKET_CLIP_UPDATED =
  'clip:updated';

export const sessionRoom = (sessionId: string) => `session:${sessionId}`;
export const clubRoom = (clubId: string) => `club:${clubId}`;

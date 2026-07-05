export type MediaKind = "video" | "folder" | "document" | "channel";

export interface MediaItem {
  id: string;
  chatId?: string;
  hash?: string;
  title: string;
  kind: MediaKind;
  thumbnail?: string;
  duration?: string;
  size?: string;
  channelId?: string;
  channelName?: string;
  addedAt?: string;
}

export interface Channel {
  id: string;
  name: string;
  thumbnail?: string;
  itemCount?: number;
}

export interface Folder {
  id: string;
  name: string;
  thumbnail?: string;
  parentId?: string;
  itemCount?: number;
}

export interface HomeData {
  featured: MediaItem[];
  channels: Channel[];
  folders: Folder[];
  recent: MediaItem[];
  isAdmin: boolean;
}

export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
  total?: number;
}

export interface WatchData {
  chatId: string;
  messageId: string;
  hash: string;
  title: string;
  filename: string;
  streamUrl: string;
  thumbnail?: string;
  size?: string;
  resolution?: string;
  channelName?: string;
  related: MediaItem[];
}

export interface SessionInfo {
  authenticated: boolean;
  isAdmin: boolean;
  username?: string;
}

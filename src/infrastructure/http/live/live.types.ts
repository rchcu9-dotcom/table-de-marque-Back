export type LiveSourceState =
  | 'ok'
  | 'detection_error'
  | 'timeout'
  | 'quota_exceeded';

export type LiveMode = 'live' | 'fallback';

export type LiveStatusResponse = {
  isLive: boolean;
  mode: LiveMode;
  channelUrl: string;
  liveVideoId: string | null;
  liveEmbedUrl: string | null;
  fallbackVideoId: string;
  fallbackEmbedUrl: string;
  updatedAt: string;
  nextRefreshInSec: number;
  sourceState: LiveSourceState;
};

export type LiveDetectionResult = {
  isLive: boolean;
  liveVideoId: string | null;
  sourceState: LiveSourceState;
};

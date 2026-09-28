export const CLIPS_QUEUE = 'clips';

export interface ClipJobData {
  clipId: string;
}

/** Wait so the recording up to the button press is flushed (recordPartDuration = 1s). */
export const CLIP_JOB_DELAY_MS = 2000;
export const CLIP_JOB_ATTEMPTS = 3;

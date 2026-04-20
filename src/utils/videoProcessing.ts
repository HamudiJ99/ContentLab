import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

async function getFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpegLoaded && ffmpegInstance) {
    if (onProgress) {
      ffmpegInstance.on('progress', ({ progress }) => {
        onProgress(Math.round((progress || 0) * 100));
      });
    }
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.round((progress || 0) * 100));
    });
  }
  await ffmpeg.load({ coreURL, wasmURL });
  ffmpegInstance = ffmpeg;
  ffmpegLoaded = true;
  return ffmpeg;
}

/**
 * Converts a video Blob/File into a streamable MP4 with the moov atom
 * at the beginning (+faststart). This enables instant seeking and
 * smooth playback at any speed via HTTP range requests.
 *
 * - MP4 input → fast remux (no re-encoding, nearly instant)
 * - WebM/other → transcode to H.264/AAC (slower but necessary)
 */
export async function processVideoForStreaming(
  input: Blob,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);

  // Clean up any leftover files
  for (const f of ['input.mp4', 'input.webm', 'input.bin', 'output.mp4']) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore */ }
  }

  const inputData = new Uint8Array(await input.arrayBuffer());
  const isMP4 = input.type === 'video/mp4' || input.type === 'video/x-m4v';
  const inputName = isMP4 ? 'input.mp4' : 'input.webm';

  await ffmpeg.writeFile(inputName, inputData);

  if (isMP4) {
    // Fast path: remux only — move moov atom to front, no re-encoding
    await ffmpeg.exec([
      '-i', inputName,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      'output.mp4',
    ]);
  } else {
    // Transcode WebM/other to H.264+AAC MP4 with faststart
    await ffmpeg.exec([
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      'output.mp4',
    ]);
  }

  const outputData = await ffmpeg.readFile('output.mp4');
  const bytes = outputData as Uint8Array;
  const resultBlob = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });

  // Clean up
  try { await ffmpeg.deleteFile(inputName); } catch { /* ignore */ }
  try { await ffmpeg.deleteFile('output.mp4'); } catch { /* ignore */ }

  return resultBlob;
}

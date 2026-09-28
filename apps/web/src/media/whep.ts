/**
 * Minimal WHEP client (WebRTC playback) for MediaMTX.
 * The SDP offer is sent once ICE gathering finishes (no trickle ICE),
 * which is enough because MediaMTX advertises its public IP as a candidate.
 */
export interface WhepSession {
  pc: RTCPeerConnection
  close: () => void
}

export async function startWhep(
  url: string,
  onStream: (stream: MediaStream) => void,
): Promise<WhepSession> {
  const pc = new RTCPeerConnection()
  pc.addTransceiver('video', { direction: 'recvonly' })
  pc.addTransceiver('audio', { direction: 'recvonly' })

  const stream = new MediaStream()
  pc.ontrack = (event) => {
    stream.addTrack(event.track)
    onStream(stream)
  }

  try {
    await pc.setLocalDescription(await pc.createOffer())
    await waitForIceGathering(pc, 2000)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription!.sdp,
    })
    if (!res.ok) throw new Error(`WHEP ${res.status}`)

    const sessionUrl = resolveLocation(url, res.headers.get('Location'))
    await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() })

    return {
      pc,
      close: () => {
        if (!sessionUrl) return pc.close()
        // End the session explicitly, then close the peer. Closing first makes MediaMTX
        // drop the session on its own and the DELETE would answer 404.
        void fetch(sessionUrl, { method: 'DELETE', signal: AbortSignal.timeout(2000) })
          .catch(() => {})
          .finally(() => pc.close())
      },
    }
  } catch (err) {
    pc.close()
    throw err
  }
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', onChange)
      clearTimeout(timer)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done()
    }
    const timer = setTimeout(done, timeoutMs)
    pc.addEventListener('icegatheringstatechange', onChange)
  })
}

function resolveLocation(requestUrl: string, location: string | null): string | null {
  if (!location) return null
  return new URL(location, new URL(requestUrl, window.location.href)).toString()
}

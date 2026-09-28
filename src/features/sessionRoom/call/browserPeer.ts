import type { IceServer } from '../model/room';
import type { PeerFactory } from './callSession';

/** Adaptador de `RTCPeerConnection` del navegador, con los servidores ICE que dio el servidor. */
export function browserPeerFactory(iceServers: IceServer[]): PeerFactory {
  return ({ onIceCandidate, onTrack, onStateChange }) => {
    const connection = new RTCPeerConnection({ iceServers });
    connection.onicecandidate = ({ candidate }) => {
      if (candidate !== null) {
        onIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        });
      }
    };
    connection.ontrack = ({ streams }) => {
      const [stream] = streams;
      if (stream !== undefined) {
        onTrack(stream);
      }
    };
    connection.onconnectionstatechange = () => {
      onStateChange(connection.connectionState);
    };
    return {
      addTrack: (track, stream) => {
        connection.addTrack(track, stream);
      },
      createOffer: () => connection.createOffer(),
      createAnswer: () => connection.createAnswer(),
      setLocalDescription: (description) => connection.setLocalDescription(description),
      setRemoteDescription: (description) => connection.setRemoteDescription(description),
      addIceCandidate: (candidate) => connection.addIceCandidate(candidate),
      close: () => {
        connection.close();
      },
    };
  };
}

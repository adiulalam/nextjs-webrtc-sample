import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useSocket from '../hooks/useSocket';

const Room = () => {
  useSocket();
  const router = useRouter();
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();

  const { id } = router.query;
  const CONSTRAINTS = {
    video: true,
    audio: true,
  };
  useEffect(() => {
    navigator.mediaDevices.getUserMedia(CONSTRAINTS).then((stream) => {
      userVideo.current.srcObject = stream;
      userStream.current = stream;

      socketRef.current = io.connect('/');
      socketRef.current.emit('join-room', id);
      socketRef.current.on('other-users', (userId) => {
        callUser(userId);
        otherUser.current = userId;
      });

      socketRef.current.on('user-joined', (userId) => {
        otherUser.current = userId;
      });

      socketRef.current.on('offer', handleReceivedCall);

      socketRef.current.on('answer', handleAnswer);

      socketRef.current.on('ice-candidate', handlerNewIceCandidateMsg);
    });
  }, [id]);

  /**
   * Takes a userid which is also the socketid and returns a WebRTC Peer
   *
   * @param  {string} userId Represents who will receive the offer
   * @returns {RTCPeerConnection} peer
   */

  function createPeer(userId) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:openrelay.metered.ca:80',
        },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationsNeededEvent(userId);
    return peer;
  }

  function callUser(userId) {
    try {
      peerRef.current = createPeer(userId);
      // We will take the tracks from each of the streams and push it to the addTrack method that exists on the
      // WebRTC Peer Object. We're taking our stream and attaching it to our peer.
      userStream.current
        .getTracks()
        .forEach((track) => peerRef.current.addTrack(track, userStream.current));
    } catch (e) {
      console.log(e)
    }
  }

  function handleNegotiationsNeededEvent(userId) {
    peerRef.current
      .createOffer() // Resolves with a promise that returns an offer object
      .then((offer) => peerRef.current.setLocalDescription(offer)) // So whenever an offer is create (or 'Answer' that the user is going to reply with), we set it as our local description but the other user will set it as their remote description
      .then(() => {
        const payload = {
          target: userId,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription, // This is the offer object that is being received
        };
        socketRef.current.emit('offer', payload);
      })
      .catch((e) => console.log(e));
  }

  function handleReceivedCall(incoming) {
    peerRef.current = createPeer(); // This function is called when we aren't the initiator, so we don't need to pass the userID
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      .setRemoteDescription(desc)
      .then(() =>
        userStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, userStream.current),
          ),
      )
      .then(() => peerRef.current.createAnswer()) // resolves with the answer object and essentially SDP data
      .then((answer) => peerRef.current.setLocalDescription(answer))
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription
        }
        socketRef.current.emit('answer', payload)
      })
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp)
    peerRef.current.setRemoteDescription(desc).catch(err => console.log(err))
  }

  function handleICECandidateEvent(event) {
    if (event.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: event.candidate
      }
      socketRef.current.emit('ice-candidate', payload)
    }
  }

  function handlerNewIceCandidateMsg (incoming) {
    const candidate = new RTCIceCandidate(incoming)
    peerRef.current.addIceCandidate(candidate).catch(e => console.log(e))
  }

  function handleTrackEvent(event) {
    // eslint-disable-next-line prefer-destructuring
    partnerVideo.current.srcObject = event.streams[0]
  }

  return (
    <div>
      <video autoPlay ref={userVideo} />
      <video autoPlay ref={partnerVideo} />
    </div>
  );
};

export default Room;

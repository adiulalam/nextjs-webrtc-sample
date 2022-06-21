import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useSocket from '../../hooks/useSocket';

const Room = () => {
  useSocket();
  const router = useRouter();
  const userVideo = useRef();
  const partnerVideo = useRef();
  const rtcConnection = useRef();
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

      // Event called when a remote user initiating the connection and
      socketRef.current.on('offer', handleReceivedOffer);

      socketRef.current.on('answer', handleAnswer);

      socketRef.current.on('ice-candidate', handlerNewIceCandidateMsg);
    });
  }, [id]);

  function callUser(userId) {
    try {
      rtcConnection.current = createPeerConnection(userId);
      // We will take the tracks from each of the streams and push it to the addTrack method that exists on the
      // WebRTC Peer Object. We're taking our stream and attaching it to our peer.
      // userStream.current
      //   .getTracks()
      //   .forEach((track) => rtcConnection.current.addTrack(track, userStream.current));
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Takes a userid which is also the socketid and returns a WebRTC Peer
   *
   * @param  {string} userId Represents who will receive the offer
   * @returns {RTCPeerConnection} peer
   */

  function createPeerConnection(userId) {
    const connection = new RTCPeerConnection({
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

    connection.onicecandidate = handleICECandidateEvent;
    connection.ontrack = handleTrackEvent;
    connection.onnegotiationneeded = () =>
      handleNegotiationsNeededEvent(userId);
    return connection;
  }

  function handleNegotiationsNeededEvent(userId) {
    rtcConnection.current
      .createOffer() // Resolves with a promise that returns an offer object
      .then((offer) => rtcConnection.current.setLocalDescription(offer)) // So whenever an offer is create (or 'Answer' that the user is going to reply with), we set it as our local description but the other user will set it as their remote description
      .then(() => {
        const payload = {
          target: userId,
          caller: socketRef.current.id,
          sdp: rtcConnection.current.localDescription, // This is the offer object that is being received
        };
        socketRef.current.emit('offer', payload);
      })
      .catch((e) => console.log(e));
  }

  function handleReceivedOffer(incoming) {
    rtcConnection.current = createPeerConnection(); // This function is called when we aren't the initiator, so we don't need to pass the userID
    const desc = new RTCSessionDescription(incoming.sdp);
    rtcConnection.current
      .setRemoteDescription(desc)
      .then(() =>
        userStream.current
          .getTracks()
          .forEach((track) =>
            rtcConnection.current.addTrack(track, userStream.current),
          ),
      )
      .then(() => rtcConnection.current.createAnswer()) // resolves with the answer object and essentially SDP data
      .then((answer) => rtcConnection.current.setLocalDescription(answer))
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: rtcConnection.current.localDescription,
        };
        socketRef.current.emit('answer', payload);
      });
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    rtcConnection.current
      .setRemoteDescription(desc)
      .catch((err) => console.log(err));
  }

  function handleICECandidateEvent(event) {
    if (event.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: event.candidate,
      };
      socketRef.current.emit('ice-candidate', payload);
    }
  }

  function handlerNewIceCandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);
    rtcConnection.current
      .addIceCandidate(candidate)
      .catch((e) => console.log(e));
  }

  function handleTrackEvent(event) {
    // eslint-disable-next-line prefer-destructuring
    partnerVideo.current.srcObject = event.streams[0];
  }

  function shareMedia() {
    if (userStream.current && rtcConnection.current) {
      userStream.current
        .getTracks()
        .forEach((track) =>
          rtcConnection.current.addTrack(track, userStream.current),
        );
    }
  }

  return (
    <div>
      <video autoPlay ref={userVideo} />
      <video autoPlay ref={partnerVideo} />
      <button type="button" onClick={shareMedia}>
        Share Media
      </button>
    </div>
  );
};

export default Room;

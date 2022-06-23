import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import useSocket from '../../hooks/useSocket';

const ICE_SERVERS = {
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
};

const Room = () => {
  useSocket();
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  const router = useRouter();
  const userVideo = useRef();
  const partnerVideo = useRef();
  const rtcConnection = useRef(null);
  const socketRef = useRef();
  const userStream = useRef();
  const host = useRef(false);

  const { id: roomName } = router.query;
  useEffect(() => {
    socketRef.current = io();
    // First we join a room
    socketRef.current.emit('join', roomName);

    socketRef.current.on('joined', handleJoiningRoom);
    // If the room didn't exist, the server would emit the room was 'created'
    socketRef.current.on('created', handRoomCreated);
    // Whenever the next person joins, the server emits 'ready'
    socketRef.current.on('ready', initiateCall);

    // Emitted when a peer leaves the room
    socketRef.current.on('leave', () => {
      // This person is now the creator because they are the only person in the room.
      host.current = true;
      if (partnerVideo.current.srcObject) {
        partnerVideo.current.srcObject
          .getTracks()
          .forEach((track) => track.stop()); // Stops receiving all track of Peer.
      }

      // Safely closes the existing connection established with the peer who left.
      if (rtcConnection.current) {
        rtcConnection.current.ontrack = null;
        rtcConnection.current.onicecandidate = null;
        rtcConnection.current.close();
        rtcConnection.current = null;
      }
    });

    // If the room is full, we show an alert
    socketRef.current.on('full', () => {
      window.location.href = '/';
    });

    // Event called when a remote user initiating the connection and
    socketRef.current.on('offer', handleReceivedOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handlerNewIceCandidateMsg);

    // clear up after
    return () => socketRef.current.disconnect();
  }, [roomName]);

  const handleJoiningRoom = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        /* use the stream */
        userStream.current = stream;
        userVideo.current.srcObject = stream;
        userVideo.current.onloadedmetadata = () => {
          userVideo.current.play();
        };
        socketRef.current.emit('ready', roomName);
      })
      .catch((err) => {
        /* handle the error */
        console.log('error', err);
      });
  };

  const handRoomCreated = () => {
    host.current = true;
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        /* use the stream */
        userStream.current = stream;
        userVideo.current.srcObject = stream;
        userVideo.current.onloadedmetadata = () => {
          userVideo.current.play();
        };
      })
      .catch((err) => {
        /* handle the error */
        console.log(err);
      });
  };

  const initiateCall = () => {
    if (host.current) {
      rtcConnection.current = createPeerConnection();
      rtcConnection.current.addTrack(
        userStream.current.getTracks()[0],
        userStream.current,
      );
      rtcConnection.current.addTrack(
        userStream.current.getTracks()[1],
        userStream.current,
      );
      rtcConnection.current
        .createOffer()
        .then((offer) => {
          rtcConnection.current.setLocalDescription(offer);
          socketRef.current.emit('offer', offer, roomName);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  /**
   * Takes a userid which is also the socketid and returns a WebRTC Peer
   *
   * @param  {string} userId Represents who will receive the offer
   * @returns {RTCPeerConnection} peer
   */

  const createPeerConnection = () => {
    // We create a RTC Peer Connection
    const connection = new RTCPeerConnection(ICE_SERVERS);

    // We implement our onicecandidate method for when we received a ICE candidate from the STUN server
    connection.onicecandidate = handleICECandidateEvent;

    // We implement our onTrack method for when we receive tracks
    connection.ontrack = handleTrackEvent;
    return connection;
  };

  const handleReceivedOffer = (offer) => {
    if (!host.current) {
      rtcConnection.current = createPeerConnection();
      rtcConnection.current.addTrack(
        userStream.current.getTracks()[0],
        userStream.current,
      );
      rtcConnection.current.addTrack(
        userStream.current.getTracks()[1],
        userStream.current,
      );
      rtcConnection.current.setRemoteDescription(offer);

      rtcConnection.current
        .createAnswer()
        .then((answer) => {
          rtcConnection.current.setLocalDescription(answer);
          socketRef.current.emit('answer', answer, roomName);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  const handleAnswer = (answer) => {
    rtcConnection.current
      .setRemoteDescription(answer)
      .catch((err) => console.log(err));
  };

  const handleICECandidateEvent = (event) => {
    if (event.candidate) {
      socketRef.current.emit('ice-candidate', event.candidate, roomName);
    }
  };

  const handlerNewIceCandidateMsg = (incoming) => {
    // We cast the incoming candidate to RTCIceCandidate
    const candidate = new RTCIceCandidate(incoming);
    rtcConnection.current
      .addIceCandidate(candidate)
      .catch((e) => console.log(e));
  };

  const handleTrackEvent = (event) => {
    // eslint-disable-next-line prefer-destructuring
    partnerVideo.current.srcObject = event.streams[0];
  };

  const toggleMediaStream = (type, state) => {
    userStream.current.getTracks().forEach((track) => {
      if (track.kind === type) {
        // eslint-disable-next-line no-param-reassign
        track.enabled = !state;
      }
    });
  };

  const toggleMic = () => {
    toggleMediaStream('audio', micActive);
    setMicActive((prev) => !prev);
  };

  const toggleCamera = () => {
    toggleMediaStream('video', cameraActive);
    setCameraActive((prev) => !prev);
  };

  const leaveRoom = () => {
    socketRef.current.emit('leave', roomName); // Let's the server know that user has left the room.

    if (userVideo.current.srcObject) {
      userVideo.current.srcObject.getTracks().forEach((track) => track.stop()); // Stops receiving all track of User.
    }
    if (partnerVideo.current.srcObject) {
      partnerVideo.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving audio track of Peer.
    }

    // Checks if there is peer on the other side and safely closes the existing connection established with the peer.
    if (rtcConnection.current) {
      rtcConnection.current.ontrack = null;
      rtcConnection.current.onicecandidate = null;
      rtcConnection.current.close();
      rtcConnection.current = null;
    }
  };

  return (
    <div>
      <video autoPlay ref={userVideo} />
      <video autoPlay ref={partnerVideo} />
      <button onClick={toggleMic} type="button">
        {micActive ? 'Mute Mic' : 'UnMute Mic'}
      </button>
      <button onClick={leaveRoom} type="button">
        Leave
      </button>
      <button onClick={toggleCamera} type="button">
        {cameraActive ? 'Stop Camera' : 'Start Camera'}
      </button>
    </div>
  );
};

export default Room;

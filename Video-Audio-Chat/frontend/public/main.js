let stream, peer, socket;
let muted = false, videoOff = false;


const room = new URLSearchParams(location.search).get('room');
if (!room) {
  alert('Need a room ID!');
  location.href = '/';
}

document.getElementById('roomTitle').textContent = `Room: ${room}`;

// WebSocket setup
const wsUrl = location.hostname === 'localhost' 
  ? 'ws://localhost:3000' 
  : 'wss://12da22b40ea7.ngrok-free.app';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:global.relay.metered.ca:80', username: 'govind', credential: 'govind' }
  ]
};

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = stream;
  } catch (e) {
    alert('Camera access denied!');
    return;
  }

  // Connect to signaling server
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => socket.send(JSON.stringify({ type: 'join', room }));
  
  socket.onmessage = async ({ data }) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'user-joined') {
      // Someone joined, create offer
      setupPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ type: 'signal', room, payload: offer }));
    }
    
    else if (msg.type === 'signal') {
      if (!peer) setupPeer();
      
      const { payload } = msg;
      if (payload.type === 'offer') {
        await peer.setRemoteDescription(payload);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: 'signal', room, payload: answer }));
      }
      else if (payload.type === 'answer') {
        await peer.setRemoteDescription(payload);
      }
      else if (payload.candidate) {
        await peer.addIceCandidate(payload);
      }
    }
    
    else if (msg.type === 'user-left') {
      document.getElementById('remoteVideo').srcObject = null;
      alert('Other user left');
    }
  };
}

function setupPeer() {
  if (peer) return;
  
  peer = new RTCPeerConnection(rtcConfig);
  
  peer.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.send(JSON.stringify({ type: 'signal', room, payload: candidate }));
    }
  };
  
  peer.ontrack = ({ streams }) => {
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = streams[0];
    remoteVideo.play().catch(() => {});
  };
  

  stream.getTracks().forEach(track => peer.addTrack(track, stream));
}

// Controls
document.getElementById('muteBtn').onclick = () => {
  muted = !muted;
  stream.getAudioTracks().forEach(track => track.enabled = !muted);
  const btn = document.getElementById('muteBtn');
  btn.classList.toggle('active', muted);
  btn.innerHTML = muted 
    ? '<i class="fas fa-microphone-slash"></i>'
    : '<i class="fas fa-microphone"></i>';
};

document.getElementById('videoBtn').onclick = () => {
  videoOff = !videoOff;
  stream.getVideoTracks().forEach(track => track.enabled = !videoOff);
  const btn = document.getElementById('videoBtn');
  btn.classList.toggle('active', videoOff);
  btn.innerHTML = videoOff 
    ? '<i class="fas fa-video-slash"></i>'
    : '<i class="fas fa-video"></i>';
};

document.getElementById('hangupBtn').onclick = () => {
  if (peer) peer.close();
  if (socket) socket.close();
  location.href = '/';
};

start();
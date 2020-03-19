// Generate random room name if needed
if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xffffff).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone("yiS12Ts5RdNhebyM");
// Room name needs to be prefixed with 'observable-'
const roomName = "observable-" + roomHash;
const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let room;//we use let isntaed of var a=1 nd we want to make it contbnt for whole tym thn use const a=1
//where var is globallly and let is locally only excess in its folder 
let pc;

function onSuccess() { }
function onError(error) {//if error come it will activate
    console.error(error);
}

drone.on("open", error => {//syntax of error is constt=()=>{}
    if (error) {
        return console.error(error);
    }
    room = drone.subscribe(roomName);//according to frst person 
    room.on("open", error => {
        if (error) {
            onError(error);
        }
    });
    // We're connected to the room and received an array of 'members'
    // connected to the room (including us). Signaling server is ready.
    room.on("members", members => {
        console.log("MEMBERS", members);
        // If we are the second user to connect to the room we will be creating the offer

        const isOfferer = members.length === 2;//triple equal to convert data type
        startWebRTC(isOfferer);//pass the same name
    });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
    drone.publish({
                room: roomName,
        message
    });
}

function startWebRTC(isOfferer) {
    pc = new RTCPeerConnection(configuration);

    // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
    // message to the other peer through the signaling server
    pc.onicecandidate = event => {
        if (event.candidate) {
            sendMessage({ candidate: event.candidate });
        }
    };

    // If user is offerer let the 'negotiationneeded' event create the offer
    if (isOfferer) {
        pc.onnegotiationneeded = () => {
            pc.createOffer()
                .then(localDescCreated)
                .catch(onError);
        };
    }

    // When a remote stream arrives display it in the #remoteVideo element
    pc.ontrack = event => {
        const stream = event.streams[0];
        if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
            remoteVideo.srcObject = stream;
        }
    };

    navigator.mediaDevices
        .getUserMedia({
            audio: true,
            video: true
        })
        .then(stream => {
            // Display your local video in #localVideo element
            localVideo.srcObject = stream;
            // Add your stream to be sent to the conneting peer
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }, onError);

    // Listen to signaling data from Scaledrone
    room.on("data", (message, client) => {
        // Message was sent by us
        if (client.id === drone.clientId) {
            return;
        }

        if (message.sdp) {
            let closeBtn = document.querySelector('#closeConnection');
            closeBtn.style.display = 'block';
            let progressBlock = document.querySelector('.progress-block');
            progressBlock.style.display = 'none';
            // This is called after receiving an offer or answer from another peer
            pc.setRemoteDescription(
                new RTCSessionDescription(message.sdp),
                () => {
                    // When receiving an offer lets answer it
                    if (pc.remoteDescription.type === "offer") {
                        pc.createAnswer()
                            .then(localDescCreated)
                            .catch(onError);
                    }
                },
                onError
            );
        } else if (message.candidate) {
            console.log("how are you");
            // Add the new ICE candidate to our connections remote description
            pc.addIceCandidate(
                new RTCIceCandidate(message.candidate),
                onSuccess,
                onError
            );
        }
    });

    document.querySelector("#closeConnection").addEventListener("click", function () {
        pc.close();
    });
}

function localDescCreated(desc) {
    pc.setLocalDescription(desc, () => sendMessage({ sdp: pc.localDescription }),
        onError
    );
}

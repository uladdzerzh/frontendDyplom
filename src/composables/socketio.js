const socket = io.connect("ws://localhost:5000/")
    socket.on('connect', (event) => {
        console.log("WebSocket connection OPENED:", event);
    });
    socket.on('disconnect', event =>{
        console.log("WebSocket connection CLOSED:", event);
    })

export function useSocketIO(){
    return socket
}
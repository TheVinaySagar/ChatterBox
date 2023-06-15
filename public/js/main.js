const socket = io();
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
// get username and room for URL used ignore query prefix to remove punctuation marks from my stings 
const { username, room}  = Qs.parse(location.search, {ignoreQueryPrefix : true});
console.log(username,room);

//join chatroom
socket.emit('joinRoom',{ username, room});

//get room and users 
    // socket.emit('joinroom',{username,room});

//get room and users    
socket.on('roomUsers',({room,users})=>{
    outputRoomName(room);
    outputUsers(users);
})

//output message from server 
socket.on('message',message=>{
    console.log(message);
    outputMessage(message);

    //scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight; 

});  

chatForm.addEventListener('submit',(e)=>{
    e.preventDefault();
  
    // get message text 
    const msg = e.target.elements.msg.value;

    //emit message to server 
    socket.emit('chatMessage',msg);

    //clear input 
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
})

//output message to the dom 
function outputMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
    <p class="text">
        ${message.text} 
    </p>`;
    document.querySelector('.chat-messages').appendChild(div);

    
}
//add room name to dom 
function outputRoomName(room){

        roomName.innerText = room;

}   

// ADD users to DOM 

function outputUsers(users){
    userList.innerHTML = `
    ${users.map(user => `<li> ${user.username} </li>`).join('')}`;
} 
const express = require("express");

const bcrypt = require("bcrypt");
const fs = require("fs");
const session = require("express-session");

// Create the Express app
const app = express();

const {createServer} = require("http");
const {Server} = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer)

// Use the 'public' folder to serve static files
app.use(express.static("public"));

// Use the json middleware to parse JSON data
app.use(express.json());

// Use the session middleware to maintain sessions
const chatSession = session({
    secret: "game",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 300000 }
});
app.use(chatSession);

// This helper function checks whether the text only contains word characters
function containWordCharsOnly(text) {
    return /^\w+$/.test(text);
}

// Handle the /register endpoint
app.post("/register", (req, res) => {
    // Get the JSON data from the body
    const { username, avatar, name, password } = req.body;
	
    //
    // D. Reading the users.json file
    //
	const users = JSON.parse(fs.readFileSync("data/users.json"));


    //
    // E. Checking for the user data correctness
    // Username, avatar, name and password are not empty
	if(!username || !avatar || !name || !password){
		res.json({ status: "error", error: "Username, avatar, name or password is empty"});
	}
	// The username contains only underscores, letters or numbers. You will find the given function containWordCharsOnly() useful here
	else if(!containWordCharsOnly(username)){
		res.json({ status: "error", error: "Username can contains word chars only"});
	}
	// The username does not exist in the current list of users. You can do this using the in operator on the users' object that you have read in the previous step
	else if(username in users){
		res.json({ status: "error", error: "Username already exists."});
	}else{
	    
		//
		// G. Adding the new user account
		//
		const hash = bcrypt.hashSync(password, 10);
		users[username] = {avatar:avatar, name:name, password:hash};

		//
		// H. Saving the users.json file
		//
		fs.writeFileSync("data/users.json", JSON.stringify(users, null, " " ));

		//
		// I. Sending a success response to the browser
		//
		res.json({status: "success"});	
	}


    // Delete when appropriate
    //res.json({ status: "error", error: "This endpoint is not yet implemented." });
});

// Handle the /signin endpoint
app.post("/signin", (req, res) => {
    // Get the JSON data from the body
    const { username, password } = req.body;

    //
    // D. Reading the users.json file
    //
	const users = JSON.parse(fs.readFileSync("data/users.json"));

    //
    // E. Checking for username/password
    //
	const user = users[username];
	if(user == null){
		res.json({ status: "error", error: "Username or Password is not correct"});
	};
	const hashedPassword = user['password']; /* a hashed password stored in users.json */
	if (!bcrypt.compareSync(password, hashedPassword)) {
		/* Passwords are not the same */
		res.json({ status: "error", error: "Username or Password is not correct"});
	};

	
    //
    // G. Sending a success response with the user account
    //
	const avatar = user['avatar'];
	const name = user['name'];
	req.session.user = {username, avatar, name};
	res.json({status: "success", user : {username, avatar, name} });


	// Delete when appropriate
    //res.json({ status: "error", error: "This endpoint is not yet implemented." });
});

// Handle the /validate endpoint
app.get("/validate", (req, res ) => {

    //
    // B. Getting req.session.user
    //
	if(req.session.user){
		const user = req.session.user;
		const avatar = user['avatar'];
		const name = user['name'];
		res.json({status: "success", user : {user, avatar, name}})
	}else{
		res.json({status: "error", error: "No session is established."})
	}

    //
    // D. Sending a success response with the user account
    //
	
	
    // Delete when appropriate
    //res.json({ status: "error", error: "This endpoint is not yet implemented." });
});

// Handle the /signout endpoint
app.get("/signout", (req, res) => {

    //
    // Deleting req.session.user
    //
	delete req.session.user;

    //
    // Sending a success response
    //
	res.json({status: "success"})
 
    // Delete when appropriate
    //res.json({ status: "error", error: "This endpoint is not yet implemented." });
});


//
// ***** Please insert your Lab 6 code here *****
//



// Use a web server to listen at port 8000
// app.listen(8000, () => {
    // console.log("The chat server has started...");
// });

httpServer.listen(8000, () => {
    console.log("The chat server has started...");
});


io.use((socket, next) => {
    chatSession(socket.request, {}, next);
});

const onlineUsers = {};
const typingUsers = {};

io.on("connection", (socket) => {
	
	// Add a new user to the online user list	
	if(socket.request.session.user){
		const {username, avatar, name} = socket.request.session.user;
		onlineUsers[username] = {avatar: avatar, name: name };
		io.emit("add user", JSON.stringify(socket.request.session.user));	
	};

	socket.on("disconnect", () => {
		// Remove the user from the online user list
		if(socket.request.session.user){
			const {username} = socket.request.session.user;
			if(onlineUsers[username]) delete onlineUsers[username];	
			io.emit("remove user", JSON.stringify(socket.request.session.user));
		}
	});
	
	socket.on("get users", () => {
		// Get the online user list
		socket.emit("users", JSON.stringify(onlineUsers));
	});


	socket.on("get messages", () => {
		// Send the chatroom messages to the browser
		const chatroom = JSON.parse(fs.readFileSync("data/chatroom.json"));

		socket.emit("messages", JSON.stringify(chatroom));
	});
	
	socket.on("post message", (content) => {
		// Add the message to the chatroom
		const chatroom = JSON.parse(fs.readFileSync("data/chatroom.json"));
		const user = socket.request.session.name;
		const date = new Date();
		
		if(socket.request.session.user){
			const {username, avatar, name} = socket.request.session.user;
			const res = {
				user: {username, avatar, name},
				datetime: date,
				content: content
			}
			chatroom.push(res);
			console.log(chatroom);		
			fs.writeFileSync("data/chatroom.json", JSON.stringify(chatroom, null, " " ));
			io.emit("add message", JSON.stringify(res));
			
		}
	});
	
				
	socket.on("typing message", (user) => {
		if(socket.request.session.user){
			const {username, avatar, name} = socket.request.session.user;
			typingUsers[username] = {avatar: avatar, name: name };
			io.emit("typing message", JSON.stringify(socket.request.session.user));
		}
		
	});

});



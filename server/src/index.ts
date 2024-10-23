import express from 'express';
import  jwt  from 'jsonwebtoken';
import { usersType } from './types';
import { createClient } from 'redis'
import { v4 as uuidv4 } from 'uuid';
const app = express();
app.use(express.json());

const secret = "hello";

const client = createClient();

let users : usersType ={

}

let rooms ={

}

app.post('/sign',async(req,res)=>{
    const { username, password} = req.body;
    const session =  jwt.sign(username, secret);
    const userId  = uuidv4();
    users[userId] = {session : session , username : username, password : password};
    res.json({session : session , userId : userId});
})


app.post('/rooms', (req, res)=>{
    const token = req.headers;
    const   { dimension }  = req.body;
    console.log(dimension);
    if(!dimension){
        res.json({msg : "please provide the dimension of the town"});
    }
     if(!token){
        res.json({msg:"token not provided"});
        return;
     }
    
     const roomId  =  uuidv4();
     const data = {dimension : dimension, roomId: roomId};
     client.rPush("data", JSON.stringify(data));
     res.json({msg:"room created" , roomId});
})

app.post('/users/:userId',(req,res)=>{
   const { userId } = req.params;
    if(!userId){
        res.json({msg:"user Id not given"});
    }
    const username = users[userId];
    res.json({username : username});
})


app.post('/users/:userId/avatar', (req,res)=>{
    const token = req.headers;
    const { userId } = req.params;
    if(!token || !userId){
        res.json({msg:"please provide token or userId"});
    }
    const username = users[userId];
    const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${username}`;
    res.json({avatarUrl : avatarUrl})
})


async function startServer(){
    try {
       await client.connect();
       console.log("connected to redis"); 
    } catch (error) {
        console.log("Error in connecting with redis");
    }

    app.listen(3000,()=>{
        console.log("server is listen on port 3000");
    })
}

startServer();
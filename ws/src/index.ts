import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { createClient } from 'redis';

const server = http.createServer(function (request, response) {
    response.end('hi');
});

const wss = new WebSocketServer({ server });

const client = createClient();

interface dimension {
    x: number,
    y: number
}

interface UserPosition {
    x: number;
    y: number;
}

const room = new Map<string, dimension>();
const user = new Map<string, UserPosition>();
const roomPositionMap = new Map<string, Map<string, UserPosition>>();

function isvalidCanvas(width: number, height: number, x: number, y: number) {
    console.log(width, height);
    if (width && height) {
        if (x > width || y > height || x < 0 || y < 0) {
            return false;
        }
    }
    return true;
}

function isvalidmove(userId: string, newposition: any) {
    const { x, y } = newposition;
    const dimension = user.get(userId);
    const width = dimension?.x;
    const height = dimension?.y;

    if (width && height) {
        if (isvalidCanvas(width, height, x, y)) {
            const oldPosition = user.get(userId);
            const oldx = oldPosition?.x;
            const oldy = oldPosition?.y;

            if (oldx !== undefined && oldy !== undefined) {
                const diffx = Math.abs(oldx - x);
                const diffy = Math.abs(oldy - y);
                if (diffx > 1 || diffy > 1) {  // Change && to ||
                    return false;
                }
            }
        } else {
            return false;
        }
    }
    return true;
}

function getRandomPosition(roomDimension: dimension) {
    const randomX = Math.floor(Math.random() * roomDimension.x);
    const randomY = Math.floor(Math.random() * roomDimension.y);
    return { x: randomX, y: randomY };
}

// function handleCloseEvent(userId)

function handlewebsocketmessage(message: any, ws: WebSocket) {
    let data;
    try {
        data = JSON.parse(message.toString());
    } catch (error) {
        console.log("Error in parsing message", error);
        return;
    }

    const { type, roomId, userId, position } = data;

    if (type === 'join_room') {
        if (!room.has(roomId)) {
            ws.send("No room exists with this roomId");
            return;
        } else {
            const roomDimension = room.get(roomId);
            let randomPosition = { x: 0, y: 0 };
            if (roomDimension) {
                randomPosition = getRandomPosition(roomDimension);
            }
            user.set(userId, randomPosition);

            // Set user positions in the room-specific map
            let roomUsers = roomPositionMap.get(roomId) || new Map<string, UserPosition>();
            roomUsers.set(userId, randomPosition);
            roomPositionMap.set(roomId, roomUsers);

            const userPosition = user.get(userId);
            ws.send(JSON.stringify(userPosition));
        }
    } else if (type === 'leave_room') {
        user.delete(userId);
        let roomUsers = roomPositionMap.get(roomId);
        roomUsers?.delete(userId);
    } else if (type === 'new_position') {
        if (isvalidmove(userId, position)) {
            const usernewPosition = user.get(userId);
            if (usernewPosition) {
                const { x, y } = position;
                usernewPosition.x = x;
                usernewPosition.y = y;
                user.set(userId, usernewPosition);

                // Update user position in the room-specific map
                let roomUsers = roomPositionMap.get(roomId);
                roomUsers?.set(userId, usernewPosition);
                roomPositionMap.set(roomId, roomUsers!);

                // Broadcast updated position to all users in the room
                roomUsers?.forEach((pos, uid) => {
                    ws.send(JSON.stringify({ userId: uid, position: pos }));
                });
            }
        } else {
            ws.send("Not a valid move");
        }
    }
}

wss.on('connection', (ws) => {
    ws.on('error', console.error);
    ws.on('message', (message) => {
        handlewebsocketmessage(message, ws);
    });
    // ws.on('close',()=>{
    //    handleCloseEvent(ws);
    // })
});

function handleRoomCreation(data: any) {
    const { dimension, roomId } = data;
    const [x, y] = dimension.split('*').map((str: string) => str.trim()).map(Number);
    room.set(roomId, { x: x, y: y });
}

async function popdatafromqueue() {
    while (true) {
        const rawdata = await client.blPop('data', 0);
        if (rawdata && rawdata.element) {
            const parseData = JSON.parse(rawdata.element);
            handleRoomCreation(parseData);
        }
    }
}

async function startServer() {
    try {
        await client.connect();
        console.log("connected to redis");

        popdatafromqueue();
    } catch (error) {
        console.log("error in connecting to redis");
    }

    server.listen(3001, () => {
        console.log("server is listening on port 3001");
    });
}

startServer();

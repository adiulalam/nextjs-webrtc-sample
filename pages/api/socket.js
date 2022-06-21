import { Server } from 'socket.io';

const rooms = {};

const SocketHandler = (req, res) => {
  if (res.socket.server.io) {
    console.log('Socket is already running');
    return res.end();
  }

  const io = new Server(res.socket.server);
  res.socket.server.io = io;

  io.on('connection', (socket) => {
    socket.on('join-room', async (roomId) => {
      if (!roomId) return;
      if (rooms[roomId]) {
        rooms[roomId].push(socket.id);
      } else {
        rooms[roomId] = [socket.id];
      }

      const otherUsers = rooms[roomId].filter((id) => id !== socket.id);
      if (otherUsers?.length) {
        for (const user of otherUsers) {
          socket.emit('other-users', user);
          socket.to(user).emit('user-joined', socket.id);
        }
      }
    });

    socket.on('disconnect', async () => {
      // TODO
    });

    // Send event to other users
    socket.on('offer', (payload) => {
      io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
      io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (incoming) => {
      io.to(incoming.target).emit('ice-candidate', incoming.candidate);
    });
  });
  return res.end();
};

export default SocketHandler;

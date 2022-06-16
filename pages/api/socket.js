import { Server } from 'socket.io'

const rooms = {}

const SocketHandler = (req, res) => {
  if (res.socket.server.io) {
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    const io = new Server(res.socket.server)
    res.socket.server.io = io

    io.on('connection', socket => {
      socket.on('join-room', async roomId => {
        if (!roomId) return
        if(rooms[roomId]) {
          rooms[roomId].push(socket.id)
        } else {
          rooms[roomId] = [socket.id]
        }

        const otherUsers = rooms[roomId].filter(id => id !== socket.id)
        if (otherUsers?.length) {
          for (const user of otherUsers) {
            socket.emit('other-users', user)
            socket.to(user).emit('user-joined', socket.id)
          }
        }
        console.log({rooms})
      })

      socket.on("disconnect", async () => {
        // TODO
      });
      
      // Send event to other users
      socket.on('offer', payload => {
        console.log('Got Offer', payload)
        io.to(payload.target).emit('offer', payload)
      })

      socket.on('answer', payload => {
        console.log('Got Answer', payload)
        io.to(payload.target).emit('answer', payload)
      })

      socket.on('ice-candidate', incoming => {
        console.log('Got Ice Candidate', incoming)
        io.to(incoming.target).emit('ice-candidate', incoming.candidate)
      })
    })
  }
  res.end()
}

export default SocketHandler
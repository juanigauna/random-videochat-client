import { createContext, useContext, useEffect, useRef } from "react"
import { io } from "socket.io-client"

export const SOCKET_URL = "http://localhost:3005"

export const SocketContext = createContext({
    socket: null
})

export const useSocketSubscribe = (eventName, eventHandler) => {
    const { socket } = useContext(SocketContext)

    useEffect(() => {
        socket.on(eventName, eventHandler)

        return () => {
            socket?.off(eventName, eventHandler)
        }

    }, [eventHandler])

}

const SocketProvider = ({ children }) => {
    const socket = useRef(io(SOCKET_URL))

    useEffect(() => {
        socket.current.on('connect', () => {
            console.log('SocketIO: Connected and authenticated')
        })

        socket.current.on('error', (msg) => {
            console.error('SocketIO: Error', msg)
        })

        return () => {
            if (socket && socket.current) {
                socket.current.removeAllListeners()
                socket.current.close()
            }
        }
    })


    return (
        <SocketContext.Provider value={{ socket: socket.current }}>
            {children}
        </SocketContext.Provider>
    )
}

export default SocketProvider
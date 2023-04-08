import Peer from "peerjs"
import { useContext, useEffect, useRef, useState } from "react"
import config from "../../config"
import { SocketContext, } from "../../Components/SocketProvider"
import { v4 } from "uuid"

const Chat = () => {
    const { socket } = useContext(SocketContext)

    const [isWaiting, setIsWaiting] = useState(true)

    const [messages, setMessages] = useState([])

    const [callSocketId, setCallSocketId] = useState(null)

    const [data, setData] = useState({
        message: ''
    })

    const [connected, setConnected] = useState(false)
    const [connection, setConnection] = useState({})

    const externalVideo = useRef({})
    const myVideo = useRef({})
    const messagesContent = useRef({})
    const messagesContainer = useRef({})

    const [messagesContentHeight, setMessagesContentHeight] = useState(0)
    const [scrollHeight, setScrollHeight] = useState(0)
    const [distanseToBottom, setDistanseToBottom] = useState(0)

    const [media] = useState({
        video: true,
        audio: true
    })

    const handleSubmit = event => {
        event.preventDefault()
        if (data.message.length > 0) {
            socket.emit('message', { callSocketId, message: data.message })
            const top = Math.round(messagesContent.current.scrollTop)
            setDistanseToBottom((messagesContent.current.scrollHeight - messagesContent.current.clientHeight) - top)
            let newList = [...messages]
            newList.push({
                message: data.message,
                me: true
            })
            setMessages(newList)
            setData({ message: '' })
        }
    }

    const handleChange = ({ target: { name, value } }) => setData({ ...data, [name]: value })

    const handleSkip = () => {
        setMessages([])
        setIsWaiting(true)
        setCallSocketId(null)

        socket.emit('skip')
        socket.on('skip-ready', () => socket.emit('search'))
        externalVideo.current.srcObject = null
    }

    socket.on('message', (data) => {
        let newList = [...messages]
        newList.push({
            message: data.message,
            me: false
        })
        setMessages(newList)
        const top = Math.round(messagesContent.current.scrollTop)
        setDistanseToBottom((messagesContent.current.scrollHeight - messagesContent.current.clientHeight) - top)
    })

    socket.on('waiting-again', () => {
        setMessages([])
        setIsWaiting(true)
        setCallSocketId(null)
        externalVideo.current.srcObject = null
    })

    useEffect(() => {
        // Inicialización cámara
        navigator.mediaDevices.getUserMedia(media)
            .then(mediaStream => {
                let myVideoStream = myVideo.current
                myVideoStream.srcObject = mediaStream
                myVideoStream.addEventListener('loadedmetadata', () => myVideoStream.play())
            })
            .catch(error => alert(error.message))
    }, [])


    useEffect(() => {
        setScrollHeight(messagesContent.current.scrollHeight)
    }, [messages])

    useEffect(() => {
        if (distanseToBottom <= 5) {
            messagesContent.current.scrollTo(0, messagesContent.current.scrollHeight)
        }
    }, [scrollHeight])

    useEffect(() => {
        window.addEventListener('resize', () => {
            setMessagesContentHeight(messagesContainer.current?.clientHeight)
        })

        const id = v4()
        let peer

        if (!connected) {
            setConnected(true)
            peer = new Peer(id, config)
            setConnection(peer)
        } else {
            peer = connection
        }


        peer.on('open', () => {
            console.log('Conexión peer inicializada. :)')

            socket.emit('peer-open', { id })
            socket.on('wait', () => setIsWaiting(true))

            socket.on('peer-id-registered', () => {
                console.log('Peer id regitrado en el servidor.')
                socket.emit('search')
            })

            socket.on('room-found', room => {
                setIsWaiting(false)
                setCallSocketId(room.client.socketId)

                navigator.mediaDevices.getUserMedia(media)
                    .then(mediaStream => {
                        const call = peer.call(room.client.peerId, mediaStream)
                        call.on('stream', externalStream => {
                            const video = externalVideo.current
                            video.srcObject = externalStream

                            video.addEventListener('loadedmetadata', () => video.play())

                        })
                        call.on('close', () => console.log('El loquito se fue...'))
                    })
                    .catch(error => alert(error.message))
            })

            socket.on('call', (data) => {
                setCallSocketId(data.id)
                setIsWaiting(false)
            })

            peer.on('call', (call) => {
                navigator.mediaDevices.getUserMedia(media)
                    .then(mediaStream => {
                        call.answer(mediaStream)

                        call.on('stream', externalStream => {
                            const video = externalVideo.current
                            video.srcObject = externalStream

                            video.addEventListener('loadedmetadata', () => video.play())
                        })
                        call.on('close', () => console.log('El loquito se fue...'))
                    })
                    .catch(error => alert(error.message))
            })
        })

        setMessagesContentHeight(messagesContainer.current?.clientHeight)
    }, [media])


    return (
        <div className="md:grid md:grid-cols-2 flex flex-col min-h-screen max-h-screen overflow-hidden">
            <div className="grid md:grid-cols-1 md:grid-rows-2 grid-cols-2 gap-[20px] md:max-h-screen md:h-full min-h-[200px] max-h-[200px] md:p-0 p-[5px] bg-black">
                <div className="flex items-center justify-center relative overflow-hidden">
                    <video className="absolute w-full" ref={externalVideo} />
                </div>
                <div className="flex items-center justify-center relative overflow-hidden">
                    <video className="absolute w-full" ref={myVideo} muted />
                </div>
            </div>

            <div ref={messagesContainer} className="flex flex-col flex-auto flex-wrap">
                <div ref={messagesContent} className="bg-gray-100 p-5 overflow-auto" style={{ maxHeight: (messagesContentHeight - 50) || 0, height: (messagesContentHeight - 50) || 0 }}>
                    {messages.length > 0 && messages.map((message, index) => (
                        <p key={index}><b>{message.me ? 'Yo' : 'Anónimo'}:</b> {message.message}</p>
                    ))}
                </div>

                <div className="flex h-[50px]">
                    <button className="h-full bg-gray-200 px-5 uppercase text-sm font-semibold" onClick={handleSkip} disabled={isWaiting}>{isWaiting ? 'Esperando...' : 'Saltar'}</button>
                    <form className="flex flex-auto" onSubmit={handleSubmit}>
                        <input className="w-full h-full px-5 outline-none" name="message" onChange={handleChange} placeholder="Escribe algo..." value={data.message} />
                        <button className="h-full bg-gray-200 px-5 uppercase text-sm font-semibold" disabled={isWaiting}>enviar</button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Chat
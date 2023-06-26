import Peer from "peerjs"
import { useContext, useEffect, useRef, useState } from "react"
import config from "../../config"
import { SocketContext, } from "../../Components/SocketProvider"
import { v4 } from "uuid"
import { RiCameraLine, RiCameraOffLine, RiMicLine, RiMicOffLine } from "react-icons/ri"

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
    const callData = useRef()

    const externalVideo = useRef({})
    const myVideo = useRef({})
    const myMediaStream = useRef()
    const externalMediaStream = useRef()
    const messagesContent = useRef({})
    const messagesContainer = useRef({})

    const [messagesContentHeight, setMessagesContentHeight] = useState(0)
    const [scrollHeight, setScrollHeight] = useState(0)
    const [distanseToBottom, setDistanseToBottom] = useState(0)

    const [media, setMedia] = useState({
        video: true,
        audio: true
    })

    const [externalMedia, setExternalMedia] = useState({
        video: true,
        audio: true
    })

    const switchMedia = (element) => {


        if (element === 'video' && media[element]) {
            myMediaStream.current.getVideoTracks()[0].stop()
        }
        if (element === 'audio' && media[element]) {
            myMediaStream.current.getAudioTracks()[0].stop()
        }
        if (!media[element]) {
            navigator.mediaDevices.getUserMedia({ ...media, [element]: !media[element] })
                .then(mediaStream => {
                    const [newTrack] = mediaStream.getVideoTracks()
                    const [newAudioTrack] = mediaStream.getAudioTracks()
                    const myVideoStream = myVideo.current
                    myMediaStream.current = mediaStream
                    myVideoStream.srcObject = mediaStream
                    callData.current.peerConnection.getSenders()[0].replaceTrack(newAudioTrack)
                    callData.current.peerConnection.getSenders()[1].replaceTrack(newTrack)
                    myVideoStream.addEventListener('loadedmetadata', () => myVideoStream.play())
                })
                .catch(error => alert(error.message))
        }

        sendSwitchMediaEvent({ ...media, [element]: !media[element] })
        setMedia({ ...media, [element]: !media[element] })
    }

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

    const sendSwitchMediaEvent = (media) => socket.emit('media:switch', { callSocketId, media })

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
        socket.on('media:switch', media => {
            console.log(media)
            setExternalMedia(media)
        })
        return () => {
            socket.off('media:switch', media => {
                console.log(media)
                setExternalMedia(media)
            })
        }
    }, [])

    useEffect(() => {
        // Inicialización cámara
        navigator.mediaDevices.getUserMedia(media)
            .then(mediaStream => {
                const myVideoStream = myVideo.current
                myMediaStream.current = mediaStream
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

                const call = peer.call(room.client.peerId, myMediaStream.current)
                callData.current = call
                call.on('stream', externalStream => {
                    const video = externalVideo.current
                    video.srcObject = externalStream

                    video.addEventListener('loadedmetadata', () => video.play())

                })
                call.on('close', () => console.log('El loquito se fue...'))
            })

            socket.on('call', (data) => {
                setCallSocketId(data.id)
                setIsWaiting(false)
            })

            peer.on('call', (call) => {
                callData.current = call
                call.answer(myMediaStream.current)

                call.on('stream', externalStream => {
                    const video = externalVideo.current
                    video.srcObject = externalStream
                    externalMediaStream.current = externalStream

                    video.addEventListener('loadedmetadata', () => video.play())
                })
                call.on('close', () => console.log('El loquito se fue...'))
            })
        })

        setMessagesContentHeight(messagesContainer.current?.clientHeight)
    }, [media])


    return (
        <div className="md:grid md:grid-cols-2 flex flex-col min-h-screen max-h-screen overflow-hidden">
            <div className="grid md:grid-cols-1 md:grid-rows-2 grid-cols-2 gap-[20px] md:max-h-screen md:h-full min-h-[200px] max-h-[200px] md:p-0 p-[5px] bg-black">
                <div className="flex items-center justify-center relative overflow-hidden">
                    <video className={`absolute w-full ${((externalMedia.audio && !externalMedia.video) || (!externalMedia.video && !externalMedia.audio)) && 'blur-lg'} ${externalMedia.video && !externalMedia.audio && 'blur-[2.5px]'}`} ref={externalVideo} />
                    {(!externalMedia.video && externalMedia.audio) &&
                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20">
                            <RiCameraOffLine className="text-white text-xl" />
                        </div>
                    }
                    {(!externalMedia.audio && externalMedia.video) &&
                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20">
                            <RiMicOffLine className="text-white text-xl" />
                        </div>
                    }
                    {(!externalMedia.audio && !externalMedia.video) &&
                        <div className="absolute top-0 left-0 w-full h-full flex gap-2 items-center justify-center z-20">
                            <RiCameraOffLine className="text-white text-xl" />
                            <RiMicOffLine className="text-white text-xl" />
                        </div>
                    }
                </div>
                <div className="flex items-center justify-center relative overflow-hidden">
                    <div className="flex gap-5 p-2 absolute left-0 top-0 bg-[#0009] z-50">
                        <button className="text-white" onClick={() => switchMedia("video")}>{media.video ? <RiCameraLine /> : <RiCameraOffLine />}</button>
                        <button className="text-white" onClick={() => switchMedia("audio")}>{media.audio ? <RiMicLine /> : <RiMicOffLine />}</button>
                    </div>
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
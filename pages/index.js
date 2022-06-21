import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState } from 'react'
import styles from '../styles/Home.module.css'

export default function Home() {
  const router = useRouter()
  const [room, setRoom] = useState('')

  const create = () => {
    router.push(`/room/${room || Math.random().toString(36).slice(2)}`)
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Native WebRTC API with NextJS</title>
        <meta name="description" content="Use Native WebRTC API for video conferencing" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
       <h1>Lets join a room!</h1>
       <input onChange={(e) => setRoom(e.target.value)} value={room} className={styles['room-name']} />
       <button onClick={create} type="button" className={styles['join-room']}>Join Room</button>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/simplewebrtc.svg" alt="Vercel Logo" width={72} height={24} />
          </span>
        </a>
      </footer>
    </div>
  )
}

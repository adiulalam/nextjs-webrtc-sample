import { useEffect, useRef } from "react";

const useSocket = () => {
  const socketCalled = useRef(false)
  useEffect(() =>{
    if (!socketCalled.current) {
      const socketInitializer = async () => {
        await fetch ('/api/socket')
      }
      try {
        socketInitializer()
        socketCalled.current = true
      } catch (error) {
        console.log(error)
      }
    }
  }, []);
};

export default useSocket
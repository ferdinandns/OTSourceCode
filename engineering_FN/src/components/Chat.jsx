import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useColorModeValue } from "@chakra-ui/react";
import {   
  Select,
  Spinner 
} from "@chakra-ui/react";

const Chat = () => {
  const kartuColor = useColorModeValue("rgba(var(--color-coba))", "rgba(var(--color-coba))");

  const [isDarkMode, setIsDarkMode] = useState(
  document.documentElement.getAttribute("data-theme") === "dark"
  );

  const userGlobal = useSelector((state) => state.user.user);
  const [isOpen, setIsOpen] = useState(false);
  const [myChat, setMyChat] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentAiResponse, setCurrentAiResponse] = useState([]);
  const [mainAIChat, setMainAIChat] = useState("");
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState("deepseek-r1:1.5b");
  const ws = useRef(null);
  const cancelTokenRef = useRef(null);
  const currentResponseRef = useRef([]);

  useEffect(() => {
    const handleThemeChange = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(currentTheme === 'dark');
    };
    // Observe attribute changes
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  // Fungsi untuk membersihkan tag <think> dan tag lain yang tidak diinginkan
  const cleanResponse = (text) => {
    if (!text) return '';
    
    // Menghapus tag <think> dan kontennya
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    // Menghapus tag <userStyle> dan kontennya kalau ada
    // cleaned = cleaned.replace(/<userStyle>[\s\S]*?<\/userStyle>/g, '');
    
    // Menghapus tag-tag lain yang mungkin tidak diinginkan.
    // cleaned = cleaned.replace(/<[^>]*>/g, ''); // Hilangkan semua tag HTML
    
    // Menghapus whitespace berlebih
    cleaned = cleaned.trim();
    
    return cleaned;
  };


  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };
  
  // Scrolling effect
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Textarea auto-resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [myChat]);

  // WebSocket initialization and message handling
  const initializeWebSocket = () => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket("ws://10.126.15.197:8002");
    
    ws.current.onopen = () => {
      console.log("WebSocket connection opened");
    };

    ws.current.onmessage = (event) => {
      const token = event.data;
      currentResponseRef.current.push(token);
      
      //buat bersihin token
      const cleanedResponse = cleanResponse(currentResponseRef.current.join(''));

      // Update messages with current accumulated response
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        
        if (lastMessage && lastMessage.sender === 'ai') {
          lastMessage.text = cleanedResponse;
          return [...newMessages];
        } else {
          return [...newMessages, {
            id: Date.now() + 1,
            text: currentResponseRef.current.join(''),
            sender: 'ai'
          }];
        }
        
      });
      console.log(messages);
    };

    ws.current.onclose = () => {
      console.log("WebSocket connection closed");
      setIsLoading(false);
      currentResponseRef.current = [];
      
      setTimeout(() => {
        initializeWebSocket();
      }, 1000);
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsLoading(false);
    };
  };

  useEffect(() => {
    initializeWebSocket();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (userMessage) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket connection is not open");
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "Connection to AI service is not available. Please try again.",
        sender: 'system'
      }]);
      return;
    }

    setMessages(prev => [...prev, {
      id: Date.now(),
      text: userMessage,
      sender: 'user'
    }]);
    
    currentResponseRef.current = [];
    setIsLoading(true);
    
    ws.current.send(JSON.stringify({ 
      machine: provider, 
      prompt: userMessage
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (myChat.trim() === "") return;
    
    sendMessage(myChat);
    setMyChat("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCancel = () => {
    if (ws.current) {
      ws.current.close();
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "Message generation cancelled.",
        sender: 'system'
      }]);
    }
  };

  return (
  <>
    <button className="fixed bottom-4 right-4 inline-flex items-center justify-center text-sm font-medium disabled:pointer-events-none disabled:opacity-50 border rounded-full w-16 h-16 bg-black hover:bg-gray-700 m-0 cursor-pointer border-gray-200 bg-none p-0 normal-case leading-5 hover:text-gray-900" type="button" aria-haspopup="dialog" aria-expanded={isOpen ? "true" : "false"} onClick={toggleChatbot}>
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white block border-gray-200 align-middle">
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" className="border-gray-200"></path>
    </svg>
    </button>
    {isOpen && (
    <div className="fixed bottom-[calc(4rem+1.5rem)] right-0 mr-4 bg-coba p-6 rounded-lg border border-border2 w-[440px] h-[592px] flex flex-col shadow-xl z-30">
    {/* Header */}
    <div className="flex flex-col space-y-1.5 pb-6">
      <h2 className="font-semibold flex flex-row text-text text-lg tracking-tight">
      <svg xmlns="http://www.w3.org/2000/svg" className=" mr-2 w-6" viewBox="0 0 24 24">
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" color="currentColor">
        <path d="M4 15.5a2 2 0 1 1 0-4m16 4a2 2 0 1 0 0-4M7 7V4m10 3V4" />
        <circle cx="7" cy="3" r="1" />
        <circle cx="17" cy="3" r="1" />
        <path
          d="M13.5 7h-3c-2.828 0-4.243 0-5.121.909S4.5 10.281 4.5 13.207s0 4.389.879 5.298c.878.909 2.293.909 5.121.909h1.025c.792 0 1.071.163 1.617.757c.603.657 1.537 1.534 2.382 1.738c1.201.29 1.336-.111 1.068-1.256c-.076-.326-.267-.847-.066-1.151c.113-.17.3-.212.675-.296c.591-.132 1.079-.348 1.42-.701c.879-.91.879-2.372.879-5.298s0-4.389-.879-5.298C17.743 7 16.328 7 13.5 7" />
        <path d="M9.5 15c.57.607 1.478 1 2.5 1s1.93-.393 2.5-1m-5.491-4H9m6.009 0H15" />
        </g>
      </svg>Chatbot
      </h2>
      <Select className="text-sm text-text leading-3 border p-1 rounded-md" 
          value={provider} 
          onChange={(e) => setProvider(e.target.value)}
          sx={{background: kartuColor,}}
          >
        <option value="deepseek-r1:1.5b">deepseek-r1:1.5b</option>
        <option value="Mistral">Mistral:7b</option>
      </Select>
      <hr className="bg-border"/>
    </div>
    {/* Messages Container */}
    <div className="flex-1 overflow-y-auto mb-4">
      <div className="flex flex-col gap-3">
      {messages.length === 0 && (
        <div className="flex gap-3 my-3 text-gray-600 text-sm">
        <span className="relative flex shrink-0 overflow-hidden rounded-full w-8 h-8">
          <div className="rounded-full bg-lingkaran border p-1">
          <svg className="fill-text" stroke="none" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"></path>
          </svg>
          </div>
        </span>
        <p className="leading-relaxed text-text">
          <span className="block font-bold text-text">AI </span>Hi, how can I help you today?
        </p>
        </div>
      )}
      {messages.map((message) => (
        <div key={message.id} className={`flex gap-3 my-3 text-gray-600 text-sm ${
        message.sender === 'user' ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
        <span className="relative flex shrink-0 overflow-hidden rounded-full w-8 h-8">
          <div className="rounded-full bg-lingkaran border p-1">
          {message.sender === 'user' ? 
          <svg className="fill-text" stroke="none" fill="none" strokeWidth="0" viewBox="0 0 16 16" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z">
            </path>
          </svg> 
          : 
          <svg className="fill-text" stroke="none" fill="none" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z">
            </path>
          </svg> }
          </div>
        </span>
        <div className="flex-1 min-w-0">
          <p className={`leading-relaxed break-words whitespace-pre-wrap text-text ${message.sender === 'user' ? 'block text-right rtl' : ' '}`}>
          <span className={`block font-bold text-text font-DMSans ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
            {message.sender === 'user' ? (userGlobal.name || 'You') : 'AI'} 
          </span>
          {message.text}
          </p>
        </div>
        </div>
      ))}
      {/* {currentAiResponse.length > 0 && (
        <div className="flex gap-3 my-3 text-gray-600 text-sm">
          <span className="relative flex shrink-0 overflow-hidden rounded-full w-8 h-8">
            <div className="rounded-full bg-lingkaran border p-1">
              <svg className="fill-text" stroke="none" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z">
                </path>
              </svg>
            </div>
          </span>
          <div className="flex-1 min-w-0">
            <p className="leading-relaxed break-words whitespace-pre-wrap text-text">
              <span className="block font-bold text-text font-DMSans">AI</span>
              {currentAiResponse.join('')}
              <span className="animate-pulse">▌</span>
            </p>
          </div>
        </div>
      )} */}
      <div ref={messagesEndRef} />
      </div>
    </div>
    {/* Input Form */}
    <form onSubmit={handleSubmit} className="flex items-end space-x-2">
      <textarea 
        ref={textareaRef}
        className="flex w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm placeholder-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#9ca3af] disabled:cursor-not-allowed disabled:opacity-50 text-black focus-visible:ring-offset-2 min-h-[40px] max-h-[150px] resize-y"
        placeholder="Type your message...."
        value={myChat}
        onChange={(e) => setMyChat(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        style={{
          overflowY: 'auto',
          wordWrap: 'break-word'
        }}
      />
      {isLoading ? (
        <button 
        type="button"
        onClick={handleCancel}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium text-white bg-card hover:bg-lingkaran h-10 px-4 py-2"
        >
        <Spinner
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.200"
          color="blue.500"
          size="sm"
        />
        </button>
      ) : (
      <button type="submit" 
        className="inline-flex items-center justify-center rounded-md text-sm font-medium text-text bg-lingkaran disabled:pointer-events-none disabled:opacity-50 hover:bg-[#cbcbcb] dark:hover:bg-[#111827E6] h-10 px-4 py-2"
      >
        Send
      </button>
      )}
    </form>
    </div>
    )}
  </>
  );
};

export default Chat
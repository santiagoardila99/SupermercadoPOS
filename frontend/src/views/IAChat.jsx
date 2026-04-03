import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Bot, User, Lightbulb, ArrowLeft, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

const SUGERENCIAS = [
  '¿Cuánto hay de tomate?',
  'Cambiar precio de leche a 3800',
  'Ventas de hoy',
  '¿Qué productos tienen poco stock?',
  'Agregar 50 unidades de arroz',
  'Buscar gaseosa',
];

export default function IAChat() {
  const [mensajes, setMensajes] = useState([
    {
      de: 'ia',
      texto: '¡Hola! Soy el asistente del supermercado 🛒\n\nPuedo ayudarte a:\n- **Consultar stock** de cualquier producto\n- **Cambiar precios** con solo pedirlo\n- **Agregar stock** cuando llegue mercancía\n- **Ver ventas** del día o del mes\n- **Buscar productos** por nombre\n\n¿En qué puedo ayudarte?',
      fecha: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [iaStatus, setIaStatus] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  useEffect(() => {
    api.get('/ia/estado').then(setIaStatus).catch(() => {});
  }, []);

  const enviar = async (texto) => {
    const msg = texto || input;
    if (!msg.trim()) return;
    setInput('');
    setMensajes(prev => [...prev, { de: 'user', texto: msg, fecha: new Date() }]);
    setEnviando(true);
    try {
      const data = await api.post('/ia/chat', { mensaje: msg });
      setMensajes(prev => [...prev, {
        de: 'ia',
        texto: data.respuesta,
        fecha: new Date(),
        accion: data.accion,
        sistemaMsg: data.mensaje_sistema
      }]);
    } catch (err) {
      setMensajes(prev => [...prev, { de: 'ia', texto: '❌ Error de conexión con el servidor.', fecha: new Date() }]);
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  };

  const toggleVoz = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Tu navegador no soporta reconocimiento de voz');
      return;
    }
    if (escuchando) {
      recognitionRef.current?.stop();
      setEscuchando(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SR();
    recognitionRef.current.lang = 'es-CO';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.onresult = (e) => {
      const transcripcion = e.results[0][0].transcript;
      setInput(transcripcion);
      setEscuchando(false);
      setTimeout(() => enviar(transcripcion), 300);
    };
    recognitionRef.current.onerror = () => { setEscuchando(false); toast.error('Error en reconocimiento de voz'); };
    recognitionRef.current.onend = () => setEscuchando(false);
    recognitionRef.current.start();
    setEscuchando(true);
    toast.success('Escuchando... habla ahora', { duration: 2000 });
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 leading-tight">Asistente IA</p>
          <p className="text-xs text-gray-400">{iaStatus?.ia_activa ? '✅ OpenAI activo' : '⚡ IA básica'}</p>
        </div>
      </div>

      {/* Estado IA */}
      {iaStatus && !iaStatus.ia_activa && (
        <div className="mx-4 mt-3 bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <p className="text-xs text-purple-700">IA básica activa. Para habilitar comandos más avanzados, configura tu clave de OpenAI en el archivo <code className="bg-purple-100 px-1 rounded">.env</code></p>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {mensajes.map((msg, i) => (
          <div key={i} className={`flex ${msg.de === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.de === 'ia' && (
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.de === 'user' ? '' : ''}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm ${msg.de === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                {msg.de === 'ia' ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                    {msg.texto.split('\n').map((line, j) => {
                      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                      return <p key={j} className="my-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: bold || '&nbsp;' }} />;
                    })}
                  </div>
                ) : msg.texto}
              </div>
              {msg.accion && (
                <div className="mt-1 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-center gap-1">
                  ✅ <span className="font-medium">Acción ejecutada:</span> {msg.accion.tipo}
                </div>
              )}
              <p className={`text-xs mt-1 ${msg.de === 'user' ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                {formatTime(msg.fecha)}
              </p>
            </div>
            {msg.de === 'user' && (
              <div className="w-8 h-8 bg-gray-200 rounded-xl flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {enviando && (
          <div className="flex justify-start gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SUGERENCIAS.map(s => (
            <button key={s} onClick={() => enviar(s)}
              className="shrink-0 text-xs bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-blue-700 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
          <button onClick={toggleVoz}
            className={`p-2 rounded-xl transition-colors shrink-0 ${escuchando ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-gray-100 text-gray-500'}`}
            title={escuchando ? 'Detener' : 'Hablar'}>
            {escuchando ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
            placeholder={escuchando ? '🎤 Escuchando...' : 'Escribe un comando o pregunta...'}
            className="flex-1 text-sm focus:outline-none bg-transparent"
            disabled={enviando || escuchando}
          />
          <button onClick={() => enviar()} disabled={!input.trim() || enviando}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

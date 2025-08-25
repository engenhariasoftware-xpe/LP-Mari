import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, RotateCcw } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface LeadInfo {
  Nome: string;
  Email: string;
  Telefone: string;
  TemGraduacao: boolean | null;
  CursoInteresse: string; // ✅ ALTERAÇÃO 1: AreaInteresse -> CursoInteresse
  ContactId: string | null;
}

interface ConversationHistoryItem {
  timestamp: string;
  message: string;
  type: 'user' | 'assistant';
}

interface WebhookResponse {
  output: string;
  conversationHistory: ConversationHistoryItem[];
  leadInfo: LeadInfo;
  summary: string;
  sessionId: string;
  contactId: string;
  dealId: string; // ✅ ALTERAÇÃO 2: Nova propriedade dealId
  emailSent?: boolean;
}

// Função para transformar URLs em links clicáveis
const linkifyText = (text: string, isUser: boolean) => {
  // Regex para detectar URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Remove caracteres indesejados do início e fim do link
      const cleanLink = part.replace(/^[().,]+|[().,]+$/g, '');
      
      // Se após a limpeza ainda temos um link válido
      if (cleanLink && (cleanLink.startsWith('http://') || cleanLink.startsWith('https://'))) {
        // Encontra os caracteres removidos do início e fim para renderizar separadamente
        const startChars = part.match(/^[().,]+/)?.[0] || '';
        const endChars = part.match(/[().,]+$/)?.[0] || '';
        
        return (
          <React.Fragment key={index}>
            {startChars}
            <a
              href={cleanLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline hover:no-underline transition-colors ${
                isUser 
                  ? 'text-green-100 hover:text-white' 
                  : 'text-blue-400 hover:text-blue-300'
              }`}
            >
              {cleanLink}
            </a>
            {endChars}
          </React.Fragment>
        );
      }
    }
    return part;
  });
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [webhookData, setWebhookData] = useState<WebhookResponse | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [showPresetMessage, setShowPresetMessage] = useState(true); // Novo estado
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mensagem pré-pronta
  const presetMessage = "Quero dar um salto na minha carreira. Pode me ajudar?";

  // Função para gerar sessionId único e seguro
  const generateUniqueSessionId = () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const extraRandom = Math.random().toString(36).substring(2, 10);
    return `sessao_${timestamp}_${randomPart}_${extraRandom}`;
  };

  // Função para salvar dados do webhook no localStorage
  const saveWebhookData = (data: WebhookResponse) => {
    try {
      // Note: Using state instead of localStorage for Claude.ai compatibility
      setWebhookData(data);
      
      // Atualizar emailSent se recebido do webhook
      if (data.emailSent !== undefined) {
        setEmailSent(data.emailSent);
      }
    } catch (error) {
      console.error('Erro ao salvar dados do webhook:', error);
    }
  };

  // Função para carregar dados do webhook do localStorage
  const loadWebhookData = (sessionId: string) => {
    try {
      // Note: Using state instead of localStorage for Claude.ai compatibility
      // Carrega dados se necessário
    } catch (error) {
      console.error('Erro ao carregar dados do webhook:', error);
    }
  };

  // Função para limpar dados do webhook
  const clearWebhookData = (sessionId: string) => {
    try {
      setWebhookData(null);
      setEmailSent(false);
    } catch (error) {
      console.error('Erro ao limpar dados do webhook:', error);
    }
  };

  // Gerar ou recuperar sessionId
  useEffect(() => {
    // Note: Using state instead of localStorage for Claude.ai compatibility
    const id = generateUniqueSessionId();
    setSessionId(id);
    
    // Carregar dados do webhook para esta sessão
    loadWebhookData(id);
  }, []);

  // Auto-scroll para última mensagem
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Função para enviar mensagem (atualizada para aceitar texto personalizado)
  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputText).trim();
    if (!text || isLoading) return;

    // Esconder mensagem pré-pronta após primeira mensagem
    if (showPresetMessage) {
      setShowPresetMessage(false);
    }

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Endpoint do n8n
      const response = await fetch('https://xpe-n8n-dsfzfte4a6cpf3a5.eastus-01.azurewebsites.net/webhook/b37c61a4-07ac-4882-bd16-00fd663d3b6a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatInput: text,
          sessionId: sessionId,
          // ContactId dinâmico recebido do webhook (null se não tiver)
          contactId: webhookData?.contactId || webhookData?.leadInfo?.ContactId || null,
          // ✅ ALTERAÇÃO 2: DealId dinâmico recebido do webhook (null se não tiver)
          dealId: webhookData?.dealId || null,
          emailSent: emailSent,
          // ✅ NOVO: Enviar leadInfo completo via webhook
          leadInfo: webhookData?.leadInfo || {
            Nome: '',
            Email: '',
            Telefone: '',
            TemGraduacao: null,
            CursoInteresse: '', // ✅ ALTERAÇÃO 1: AreaInteresse -> CursoInteresse
            ContactId: null
          },
          // ✅ NOVO: Enviar também conversationHistory se disponível
          conversationHistory: webhookData?.conversationHistory || [],
          // ✅ NOVO: Enviar summary se disponível
          summary: webhookData?.summary || ''
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      let botResponse = '';

      if (contentType && contentType.includes('application/json')) {
        const responseData = await response.json();
        
        // Verificar se a resposta tem a estrutura esperada
        if (responseData && responseData.output) {
          const webhookResponse = responseData as WebhookResponse;
          
          // Salvar dados do webhook
          saveWebhookData(webhookResponse);
          
          // Usar output como resposta do bot
          botResponse = webhookResponse.output;
          
        } else if (typeof responseData === 'string') {
          botResponse = responseData;
        } else {
          botResponse = 'Desculpe, não consegui processar a resposta. Tente novamente.';
        }
      } else {
        botResponse = await response.text();
      }

      // Adicionar resposta da Mari
      const mariMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, mariMessage]);
    } catch (error) {
      console.error('Erro ao conectar:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Estou passando por uma instabilidade na conexão. Você poderia reenviar a última mensagem, por favor?',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Função para enviar mensagem pré-pronta
  const handlePresetMessage = () => {
    handleSendMessage(presetMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    const confirmClear = window.confirm('Tem certeza que deseja iniciar uma nova conversa? Todas as mensagens atuais serão perdidas.');
    
    if (confirmClear) {
      // Limpar dados do webhook da sessão atual
      clearWebhookData(sessionId);
      
      // Gerar novo sessionId único
      const newSessionId = generateUniqueSessionId();
      setSessionId(newSessionId);
      
      // Limpar mensagens
      setMessages([]);
      
      // Mostrar mensagem pré-pronta novamente
      setShowPresetMessage(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo XPe */}
            <div className="flex items-center">
              <div className="text-white">
                <span className="text-xl font-bold text-white">Faculdade</span>
                <br />
                <span className="text-2xl font-bold">
                  <span className="text-white">XP</span>
                  <span className="text-green-500">e</span>
                </span>
              </div>
            </div>

            {/* Botões do header */}
            <div className="flex items-center space-x-4">
              <button
                onClick={clearChat}
                className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors"
                title="Nova Conversa"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm font-medium">Nova Conversa</span>
              </button>
              <button className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full font-medium transition-colors">
                Matricule-se
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Título do Chat */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Chat com <span className="text-green-500">Mari</span>
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Sua assistente inteligente especializada em educação
          </p>
          <p className="text-gray-400">
            Tire suas dúvidas sobre cursos, carreiras e muito mais
          </p>
        </div>

        {/* Chat Container */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-lg overflow-hidden max-w-4xl mx-auto">
          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto p-6 space-y-4 bg-gray-800">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-lg font-medium text-white">Olá! Sou a Mari 👋</p>
                <p className="text-sm mt-2 mb-6">Sua assistente da XP Educação. Como posso te ajudar?</p>
                
                {/* Mensagem pré-pronta */}
                {showPresetMessage && (
                  <div className="mt-6">
                    <button
                      onClick={handlePresetMessage}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-medium transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-lg"
                    >
                      {presetMessage}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.isUser
                      ? 'bg-green-500 text-white ml-4'
                      : 'bg-gray-700 text-white mr-4 border border-gray-600'
                  }`}
                >
                  {!message.isUser && (
                    <div className="flex items-center mb-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-2">
                        <MessageCircle className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm font-medium text-green-600">Mari</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">
                    {linkifyText(message.text, message.isUser)}
                  </p>
                  <span className={`text-xs opacity-60 mt-2 block ${message.isUser ? 'text-green-100' : 'text-gray-400'}`}>
                    {message.timestamp.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 rounded-2xl px-4 py-3 mr-4 border border-gray-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium text-green-600">Mari</span>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-gray-800 border-t border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua pergunta..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputText.trim()}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer - completamente limpo */}
        <div className="mt-6 text-center">
          {/* Nenhuma informação técnica exibida */}
        </div>
      </main>
    </div>
  );
}

export default App;
import { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Sparkles, Send, Lightbulb, Bot, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const suggestedQuestions = [
  "Como posso economizar mais?",
  "Onde estou gastando demais?",
  "Dicas para alcançar minhas metas",
  "Análise geral das minhas finanças"
];

export default function AITipsPage() {
  const [question, setQuestion] = useState('');
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleGetTip = async (customQuestion = null) => {
    const q = customQuestion || question;
    setLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/ai/tips`, {
        question: q || null
      });
      
      setTips(prev => [{
        question: q || 'Dica personalizada',
        tip: response.data.tip,
        context: response.data.context,
        timestamp: new Date().toISOString()
      }, ...prev]);
      
      setQuestion('');
    } catch (error) {
      toast.error('Erro ao obter dica');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuestion(suggestion);
    handleGetTip(suggestion);
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="ai-tips-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-chart-3" />
          Dicas com IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Receba insights personalizados baseados nas suas finanças
        </p>
      </div>

      {/* Input Section */}
      <Card className="bg-card border-border" data-testid="ai-input-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-chart-3" />
            Pergunte ao assistente financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Textarea
              data-testid="ai-question-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Faça uma pergunta sobre suas finanças ou clique em uma sugestão abaixo..."
              className="min-h-[100px] pr-12 resize-none bg-background/50"
            />
            <Button
              size="icon"
              className="absolute bottom-3 right-3 rounded-full"
              onClick={() => handleGetTip()}
              disabled={loading}
              data-testid="send-question-btn"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="rounded-full text-sm"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={loading}
                data-testid={`suggestion-btn-${index}`}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          
          <Button 
            className="w-full rounded-full gap-2"
            onClick={() => handleGetTip()}
            disabled={loading}
            data-testid="get-ai-tip-btn"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analisando suas finanças...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Obter Dica Personalizada
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Tips History */}
      {tips.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Histórico de Dicas</h2>
          {tips.map((tip, index) => (
            <Card 
              key={index} 
              className="bg-card border-border hover:border-chart-3/30 transition-colors"
              data-testid={`tip-card-${index}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-chart-3/20 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-5 h-5 text-chart-3" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {tip.question}
                    </p>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {tip.tip}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {tip.context}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="text-center py-12">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Clique em "Obter Dica Personalizada" para começar
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              A IA vai analisar suas transações e metas para dar conselhos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
